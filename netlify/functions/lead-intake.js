const { createClient } = require('@supabase/supabase-js');

// Inquiries land in the APP project (yqzuugqgvxyyvkkqqyok) as of its migration
// 016. They used to go to a Supabase project of their own, which left the office
// app's customers in one database and the leads that produced them in another —
// so leads.customer_id could never be a real foreign key, and converting a lead
// into a customer could never be one transaction.
//
// The URL is hardcoded and the key read from APP_SUPABASE_SERVICE_KEY, matching
// how every function in the App/Quote repo reaches this project. The old generic
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vars are no longer read at all, so a
// stale value left on this Netlify site cannot quietly send new inquiries back
// to the retired project.
const SUPABASE_URL = 'https://yqzuugqgvxyyvkkqqyok.supabase.co';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const SERVICE_KEY = process.env.APP_SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) {
    // Built inside the handler rather than at module load so a missing key is a
    // logged 500 on one submission, not a function that fails to boot at all.
    console.error('lead-intake: APP_SUPABASE_SERVICE_KEY is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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
        other_details: data.otherDetails ? data.otherDetails.trim() : null,
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