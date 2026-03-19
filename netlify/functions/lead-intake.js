const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    // Spam check (hidden field)
    if (data.website && String(data.website).trim() !== '') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Spam detected' }),
      };
    }

    // Required fields
    const required = [
      'firstName',
      'lastName',
      'street',
      'city',
      'zip',
      'phone',
      'contactMethod'
    ];

    for (const key of required) {
      if (!data[key] || String(data[key]).trim() === '') {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing field: ${key}` }),
        };
      }
    }

    if (!Array.isArray(data.services) || data.services.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'At least one service is required' }),
      };
    }

    // Insert into Supabase
    const { error } = await supabase.from('leads').insert([
      {
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        street: data.street.trim(),
        city: data.city.trim(),
        zip: data.zip.trim(),
        phone: data.phone.trim(),
        email: data.email ? data.email.trim() : null,
        services: data.services,
        details: data.details ? data.details.trim() : null,
        contact_method: data.contactMethod.trim(),
        source: 'website',
        status: 'new',
      },
    ]);

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
};