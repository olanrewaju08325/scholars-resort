# Run this script to set your SMTP secrets securely in your Supabase project's Edge Functions.
# Replace the placeholder values with your actual SMTP details before running.

$SMTP_HOSTNAME = "smtp.yourprovider.com"    # e.g., smtp.gmail.com
$SMTP_PORT = "465"                          # e.g., 465 or 587
$SMTP_USERNAME = "your_email@gmail.com"     # e.g., your full email
$SMTP_PASSWORD = "your_app_password"        # e.g., your App Password (not your normal email password if using Gmail)
$FROM_EMAIL = "alerts@scholarsresort.com"   # The email it will say it is from

Write-Host "Setting SMTP secrets in Supabase..." -ForegroundColor Cyan

# Set secrets via Supabase CLI
supabase secrets set SMTP_HOSTNAME=$SMTP_HOSTNAME SMTP_PORT=$SMTP_PORT SMTP_USERNAME=$SMTP_USERNAME SMTP_PASSWORD=$SMTP_PASSWORD FROM_EMAIL=$FROM_EMAIL

Write-Host "Secrets set successfully!" -ForegroundColor Green
Write-Host "Deploying Edge Functions to apply secrets..." -ForegroundColor Cyan

supabase functions deploy payment-notification
supabase functions deploy guardian-report

Write-Host "Edge Functions deployed securely! SMTP is now active." -ForegroundColor Green
