import http from 'http';

const data = JSON.stringify({
  to: 'olanrewajuhamilot@gmail.com',
  subject: 'Test Email from System Admin - Scholars Resort',
  html: '<p>If you are receiving this, the SMTP server configuration is working successfully across all scenarios.</p>'
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/send-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let d = '';
  res.on('data', chunk => {
    d += chunk;
  });
  res.on('end', () => {
    console.log('Response:', d);
  });
});

req.on('error', error => {
  console.error('Request Error:', error.message);
});

req.write(data);
req.end();
