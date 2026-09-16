import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Environment Supabase Config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://syoodykedvqaoeplmamd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LOCAL_PARTICIPANTS_FILE = path.join(process.cwd(), '.data_tournament_participants.json');
const LOCAL_REMINDERS_FILE = path.join(process.cwd(), '.data_tournament_reminders.json');
const LOCAL_SENT_ALERTS_FILE = path.join(process.cwd(), '.data_tournament_sent_alerts.json');

export interface WorkerRunResult {
  timestamp: string;
  tournamentsScanned: number;
  upcomingFound: number;
  emailsSent: number;
  recipientsNotified: string[];
  errors: string[];
}

export interface WorkerStatus {
  isRunning: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  totalEmailsDispatched: number;
  lastRunResult: WorkerRunResult | null;
  recentDispatches: {
    tournamentId: string;
    tournamentTitle: string;
    recipientEmail: string;
    alertType: 'upcoming_30m' | 'starting_now';
    dispatchedAt: string;
  }[];
}

let workerInterval: NodeJS.Timeout | null = null;
let isExecutingCheck = false;
let totalEmailsDispatched = 0;
let lastRunAt: string | null = null;
let lastRunResult: WorkerRunResult | null = null;
const recentDispatches: WorkerStatus['recentDispatches'] = [];

/**
 * Load set of already sent alerts to prevent duplicate notifications
 */
function getSentAlertsMap(): Record<string, string> {
  try {
    if (fs.existsSync(LOCAL_SENT_ALERTS_FILE)) {
      const raw = fs.readFileSync(LOCAL_SENT_ALERTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function saveSentAlertsMap(map: Record<string, string>) {
  try {
    fs.writeFileSync(LOCAL_SENT_ALERTS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[Tournament Worker] Failed to persist sent alerts map:', err?.message);
  }
}

/**
 * Resolve working SMTP Transporter
 */
async function resolveSmtpTransporter(): Promise<{ transporter: nodemailer.Transporter; senderEmail: string }> {
  let host = process.env.SMTP_HOST || '';
  let port = Number(process.env.SMTP_PORT) || 587;
  let user = process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
  let pass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';
  let senderEmail = process.env.SMTP_FROM || 'admitwise2@gmail.com';

  // Check admin_settings for saved SMTP configuration
  try {
    const { data: adminRows } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['smtp_settings', 'smtp_config', 'system_config']);

    if (adminRows && Array.isArray(adminRows)) {
      for (const row of adminRows) {
        const val = row.setting_value;
        if (val && typeof val === 'object') {
          if (val.host && !host) host = val.host;
          if (val.port && port === 587) port = Number(val.port) || 587;
          if (val.user && !user) user = val.user;
          if (val.pass && !pass) pass = String(val.pass).trim().replace(/\s+/g, '');
          if ((val.fromEmail || val.from) && senderEmail === 'admitwise2@gmail.com') {
            senderEmail = val.fromEmail || val.from;
          }
        }
      }
    }
  } catch {}

  const cleanPass = pass.trim().replace(/\s+/g, '');
  const cleanUser = user.trim();
  const cleanHost = host.trim();
  const isGmail = cleanHost.toLowerCase().includes('gmail') || cleanUser.toLowerCase().includes('@gmail.com');
  const isSecure = port === 465;

  let transporter: nodemailer.Transporter;
  if (isGmail || !cleanHost) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: cleanUser, pass: cleanPass },
      tls: { rejectUnauthorized: false }
    });
  } else {
    transporter = nodemailer.createTransport({
      host: cleanHost,
      port,
      secure: isSecure,
      auth: cleanUser && cleanPass ? { user: cleanUser, pass: cleanPass } : undefined,
      tls: { rejectUnauthorized: false }
    });
  }

  return { transporter, senderEmail: senderEmail || cleanUser || 'admitwise2@gmail.com' };
}

/**
 * Main Check Function:
 * Detects upcoming tournaments and dispatches emails via SMTP to registered and planned users
 */
export async function runTournamentReminderCheck(): Promise<WorkerRunResult> {
  if (isExecutingCheck) {
    return {
      timestamp: new Date().toISOString(),
      tournamentsScanned: 0,
      upcomingFound: 0,
      emailsSent: 0,
      recipientsNotified: [],
      errors: ['Previous check is still actively executing']
    };
  }

  isExecutingCheck = true;
  const runTimestamp = new Date().toISOString();
  const notifiedRecipients: string[] = [];
  const errors: string[] = [];
  let upcomingCount = 0;
  let sentCount = 0;
  let totalTournamentsScanned = 0;

  try {
    const sentAlerts = getSentAlertsMap();

    // 1. Gather all tournaments (DB + Settings)
    const tournamentMap = new Map<string, any>();

    // From tournaments table
    try {
      const { data: dbTournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_time', { ascending: true });

      if (!error && Array.isArray(dbTournaments)) {
        dbTournaments.forEach(t => {
          if (t && t.id) tournamentMap.set(t.id, t);
        });
      }
    } catch (e: any) {
      errors.push(`Supabase tournaments query note: ${e.message}`);
    }

    // From admin_settings.tournaments_db
    try {
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'tournaments_db')
        .maybeSingle();

      if (Array.isArray(settingData?.setting_value)) {
        settingData.setting_value.forEach((t: any) => {
          if (t && t.id && !tournamentMap.has(t.id)) {
            tournamentMap.set(t.id, t);
          }
        });
      }
    } catch (_) {}

    // Planned reminders
    const reminders: any[] = [];
    try {
      if (fs.existsSync(LOCAL_REMINDERS_FILE)) {
        const raw = fs.readFileSync(LOCAL_REMINDERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) reminders.push(...parsed);
      }
    } catch (_) {}

    // Ensure tournaments referenced in planned reminders are also evaluated
    reminders.forEach((r: any) => {
      if (r.tournamentId && !tournamentMap.has(r.tournamentId)) {
        tournamentMap.set(r.tournamentId, {
          id: r.tournamentId,
          title: r.tournamentTitle || 'UTME Championship Tournament',
          start_time: r.startTime,
          subject: 'UTME Championship Challenge',
          questions_count: 40,
          duration_minutes: 45
        });
      }
    });

    const allTournaments = Array.from(tournamentMap.values());
    totalTournamentsScanned = allTournaments.length;

    // 2. Gather registered participants
    const participants: any[] = [];
    try {
      if (fs.existsSync(LOCAL_PARTICIPANTS_FILE)) {
        const raw = fs.readFileSync(LOCAL_PARTICIPANTS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) participants.push(...parsed);
      }
    } catch (_) {}

    try {
      const { data: partData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'tournament_participants_db')
        .maybeSingle();
      if (Array.isArray(partData?.setting_value)) {
        partData.setting_value.forEach((p: any) => {
          if (!participants.some(existing => existing.id === p.id)) {
            participants.push(p);
          }
        });
      }
    } catch (_) {}

    // 3. Scan tournaments for upcoming start times
    const now = Date.now();
    const { transporter, senderEmail } = await resolveSmtpTransporter();

    for (const tournament of allTournaments) {
      if (tournament.status === 'completed' || tournament.status === 'cancelled') {
        continue;
      }

      const startTimeMs = new Date(tournament.start_time || tournament.startTime || 0).getTime();
      if (!startTimeMs || isNaN(startTimeMs)) continue;

      const diffMs = startTimeMs - now;
      const diffMinutes = Math.round(diffMs / 60000);

      // Alert Criteria:
      // A. "upcoming_30m": Tournament starts in 0 to 45 minutes
      // B. "starting_now": Tournament started in the last 15 minutes or starts within 2 minutes
      let alertType: 'upcoming_30m' | 'starting_now' | null = null;
      if (diffMinutes >= 3 && diffMinutes <= 45) {
        alertType = 'upcoming_30m';
      } else if (diffMinutes < 3 && diffMinutes >= -15) {
        alertType = 'starting_now';
      }

      if (!alertType) continue;
      upcomingCount++;

      // Find all target candidates for this tournament
      const targetCandidates = new Map<string, { email: string; name: string }>();

      // A. Add registered participants
      participants.forEach((p: any) => {
        const matchesTourn = p.tournament_id === tournament.id || (tournament.legacy_id && p.tournament_id === tournament.legacy_id);
        const email = (p.user_email || '').trim().toLowerCase();
        if (matchesTourn && email && email.includes('@')) {
          targetCandidates.set(email, {
            email,
            name: p.user_name || 'Scholar Candidate'
          });
        }
      });

      // B. Add candidates who scheduled reminders
      reminders.forEach((r: any) => {
        const matchesTourn = r.tournamentId === tournament.id || (tournament.legacy_id && r.tournamentId === tournament.legacy_id);
        const email = (r.userEmail || '').trim().toLowerCase();
        if (matchesTourn && email && email.includes('@')) {
          if (!targetCandidates.has(email)) {
            targetCandidates.set(email, {
              email,
              name: r.userName || 'Scholar Candidate'
            });
          }
        }
      });

      // Dispatch SMTP Email Notification to each candidate
      for (const [candidateEmail, candidate] of targetCandidates.entries()) {
        const alertDedupeKey = `${tournament.id}_${candidateEmail}_${alertType}`;

        // Skip if already sent within the past 6 hours
        if (sentAlerts[alertDedupeKey]) {
          continue;
        }

        const isLiveNow = alertType === 'starting_now';
        const formattedDate = new Date(tournament.start_time).toLocaleString('en-NG', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const subject = isLiveNow
          ? `🔥 ARENA OPEN: "${tournament.title}" is NOW LIVE!`
          : `⏰ STARTING SOON: "${tournament.title}" begins in ~${Math.max(1, diffMinutes)} mins!`;

        const arenaUrl = `https://ais-dev-ity2upo7enzaao2otb7fcf-761006180903.europe-west2.run.app/tournaments/${tournament.id}`;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #312e81; text-align: left;">
              <span style="display: inline-block; background-color: ${isLiveNow ? '#ef4444' : '#f59e0b'}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                ${isLiveNow ? '🔴 LIVE ARENA ACTIVE' : '⏳ STARTING SHORTLY'}
              </span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                ${tournament.title}
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">
                Official UTME Championship Series &bull; Scholars Resort
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #e2e8f0;">
                Hello <strong>${candidate.name}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                ${isLiveNow
                  ? 'The tournament doors are now officially OPEN! Other registered candidates are currently in the duel arena competing for the leaderboard crown and cash rewards.'
                  : `Your upcoming registered tournament is scheduled to begin in approximately <strong>${diffMinutes} minutes</strong>. Please prepare your workstation and review your formula sheets.`}
              </p>

              <!-- Event Details Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Subject Focus</td>
                        <td align="right" style="padding-bottom: 12px; font-size: 14px; color: #38bdf8; font-weight: 700;">${tournament.subject || 'All UTME Core Subjects'}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Scheduled Start</td>
                        <td align="right" style="padding-bottom: 12px; font-size: 14px; color: #fbbf24; font-weight: 700;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Duration & Questions</td>
                        <td align="right" style="padding-bottom: 12px; font-size: 14px; color: #f8fafc; font-weight: 600;">${tournament.questions_count || 40} Questions &bull; ${tournament.duration_minutes || 45} mins</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Prize Pool</td>
                        <td align="right" style="font-size: 15px; color: #10b981; font-weight: 800;">${tournament.prize_pool ? `₦${Number(tournament.prize_pool).toLocaleString()}` : 'Top Rank Honors & Cash Prizes'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${arenaUrl}" style="display: inline-block; width: 85%; max-width: 380px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 16px 24px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37,99,235,0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                      ${isLiveNow ? '⚔️ Enter Live Duel Arena Now' : '🚀 Go to Tournament Lobby'}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
                Pro Tip: Speed and accuracy both count toward your overall tournament ranking. Do not refresh once questions begin!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                You received this notification because you registered or requested an alert for this tournament event on Scholars Resort.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        try {
          await transporter.sendMail({
            from: `"Scholars Resort Tournaments" <${senderEmail}>`,
            to: candidateEmail,
            subject,
            html: htmlContent
          });

          // Mark alert as sent
          sentAlerts[alertDedupeKey] = new Date().toISOString();
          sentCount++;
          totalEmailsDispatched++;
          notifiedRecipients.push(`${candidateEmail} (${tournament.title} - ${alertType})`);

          recentDispatches.unshift({
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            recipientEmail: candidateEmail,
            alertType,
            dispatchedAt: new Date().toISOString()
          });
          if (recentDispatches.length > 50) recentDispatches.pop();

          console.log(`[Tournament Worker] Sent ${alertType} email to ${candidateEmail} for "${tournament.title}".`);
        } catch (mailErr: any) {
          errors.push(`Email error to ${candidateEmail}: ${mailErr.message}`);
          console.warn(`[Tournament Worker] Failed to send email to ${candidateEmail}:`, mailErr.message);
        }
      }
    }

    // Save updated dedupe map
    saveSentAlertsMap(sentAlerts);

    // Update status in reminders file
    if (reminders.length > 0) {
      let updatedReminders = false;
      reminders.forEach(r => {
        if (r.status === 'pending' && notifiedRecipients.some(rec => rec.startsWith(r.userEmail))) {
          r.status = 'sent';
          r.sent_at = new Date().toISOString();
          updatedReminders = true;
        }
      });
      if (updatedReminders) {
        try {
          fs.writeFileSync(LOCAL_REMINDERS_FILE, JSON.stringify(reminders, null, 2), 'utf-8');
        } catch (_) {}
      }
    }
  } catch (err: any) {
    errors.push(`Worker exception: ${err.message}`);
    console.error('[Tournament Worker Execution Error]', err);
  } finally {
    isExecutingCheck = false;
  }

  const result: WorkerRunResult = {
    timestamp: runTimestamp,
    tournamentsScanned: totalTournamentsScanned,
    upcomingFound: upcomingCount,
    emailsSent: sentCount,
    recipientsNotified: notifiedRecipients,
    errors
  };

  lastRunAt = runTimestamp;
  lastRunResult = result;
  return result;
}

/**
 * Starts background worker interval (runs every 60 seconds)
 */
export function startTournamentReminderWorker(intervalMs: number = 60000) {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  console.log(`[Tournament Worker] Background cron worker initialized (interval: ${intervalMs / 1000}s).`);

  // Initial delayed execution after 5s to avoid startup contention
  setTimeout(() => {
    runTournamentReminderCheck().catch(err => {
      console.warn('[Tournament Worker Initial Run Note]', err?.message);
    });
  }, 5000);

  // Set recurring interval
  workerInterval = setInterval(() => {
    runTournamentReminderCheck().catch(err => {
      console.warn('[Tournament Worker Interval Note]', err?.message);
    });
  }, intervalMs);
}

/**
 * Stops the background worker
 */
export function stopTournamentReminderWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Tournament Worker] Background cron worker stopped.');
  }
}

/**
 * Get current worker telemetry status
 */
export function getTournamentReminderWorkerStatus(): WorkerStatus {
  return {
    isRunning: Boolean(workerInterval),
    intervalSeconds: 60,
    lastRunAt,
    totalEmailsDispatched,
    lastRunResult,
    recentDispatches
  };
}
