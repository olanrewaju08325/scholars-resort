// Netlify serverless function for Groq AI chat proxy
export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.7 } = JSON.parse(event.body || '{}');

    // Retrieve Groq API Key from environment variables
    const rawKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
    const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey || apiKey.length < 10) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'GROQ_API_KEY is not configured or is invalid.' })
      };
    }

    const candidateModels = [model, 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama-3.3-70b-versatile', 'llama3-8b-8192'].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;
    for (const m of candidateModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: m,
            messages,
            temperature: Math.min(2.0, Math.max(0.0, Number(temperature) || 0.7)),
            max_tokens: 2048
          })
        });

        const data = await response.json();

        if (response.ok && data?.choices?.[0]?.message?.content) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(data)
          };
        } else {
          lastError = data?.error?.message || `HTTP ${response.status}`;
        }
      } catch (err: any) {
        lastError = err?.message;
      }
    }

    return {
      statusCode: 502,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: lastError || 'Groq API request failed' })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
};
