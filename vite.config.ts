import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import nodemailer from 'nodemailer';

// Custom Vite plugin to handle /api/send-otp in local dev
const apiMockPlugin = () => ({
  name: 'api-mock-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/send-otp' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const { otp, to_email } = JSON.parse(body);
            if (!otp || !to_email) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing otp or to_email' }));
            }

            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'admitwise2@gmail.com',
                pass: 'fliwopndlqxipara'
              }
            });

            await transporter.sendMail({
              from: '"Scholars Resort Admin" <admitwise2@gmail.com>',
              to: to_email,
              subject: 'Admin Login OTP',
              html: `<div style="font-family: sans-serif; padding: 20px;">
                      <h2>Scholars Resort Admin</h2>
                      <p>Your Master Admin Login Code is:</p>
                      <h1 style="color: #4F46E5; letter-spacing: 5px;">${otp}</h1>
                      <p>Do not share this code with anyone.</p>
                    </div>`
            });
            
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to send OTP' }));
          }
        });
        return;
      }
      if (req.url === '/api/guardian-report' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => body += chunk.toString());
        req.on('end', async () => {
          try {
            const { guardianEmail, guardianName, studentName, totalExams, avgScore, streak } = JSON.parse(body);
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: 'admitwise2@gmail.com', pass: 'fliwopndlqxipara' }
            });
            await transporter.sendMail({
              from: '"Scholars Resort" <admitwise2@gmail.com>',
              to: guardianEmail,
              subject: `Weekly Progress Report: ${studentName}`,
              html: `<h2>Weekly Progress Report for ${studentName}</h2>
                     <p>Dear ${guardianName || 'Guardian'},</p>
                     <ul>
                       <li><strong>Exams Completed:</strong> ${totalExams}</li>
                       <li><strong>Average Score:</strong> ${avgScore}%</li>
                       <li><strong>Current Streak:</strong> ${streak} days</li>
                     </ul>`
            });
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      if (req.url === '/api/payment-notification' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => body += chunk.toString());
        req.on('end', async () => {
          try {
            const { userId, amount, proofUrl, planId } = JSON.parse(body);
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: 'admitwise2@gmail.com', pass: 'fliwopndlqxipara' }
            });
            await transporter.sendMail({
              from: '"Scholars Resort System" <admitwise2@gmail.com>',
              to: 'admitwise2@gmail.com', // send to admin
              subject: `New Manual Payment Upload`,
              html: `<p>New payment proof uploaded by User: ${userId}</p>
                     <p>Amount: ₦${amount}</p>
                     <p>Plan: ${planId}</p>
                     <a href="${proofUrl}">View Receipt</a>`
            });
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    apiMockPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'scholar.jpg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Scholars Resort',
        short_name: 'ScholarsResort',
        description: 'Learn Smart. Score High. Secure Your Future.',
        theme_color: '#0B1526',
        icons: [
          {
            src: 'scholar.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'scholar.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 3000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
