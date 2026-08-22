const http = require('http');

const data = JSON.stringify({
  to: 'olanrewajuhamilot@gmail.com',
  subject: 'Test Email from System Admin',
  body: '<p>If you are receiving this, the SMTP server configuration is working successfully.</p>'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let d = '';
  res.on('data', chunk => {
    d += chunk;
  });
  res.on('end', () => {
    console.log(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
