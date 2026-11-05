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

// Customer photos. The form shrinks each one to 1600px JPEG before sending, so
// a real one is a few hundred KB; the per-photo cap only stops abuse.
const PHOTO_BUCKET = 'job-files';
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// A data URL (or bare base64) that really is a JPEG, as a Buffer; else null.
// Checking the bytes, not the label, keeps anything but a picture out of a
// bucket that also holds every job's PDFs.
function decodeJpeg(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(?:data:image\/jpeg;base64,)?([A-Za-z0-9+/]+={0,2})$/);
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 4 || buf.length > MAX_PHOTO_BYTES) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  return buf;
}

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

    // Optional photos, checked before anything is written so a bad batch is a
    // plain 400 rather than a lead saved with half its pictures.
    const photos = data.photos == null ? [] : data.photos;
    if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Up to ${MAX_PHOTOS} photos allowed` }),
      };
    }
    const photoBuffers = [];
    for (const p of photos) {
      const buf = decodeJpeg(p);
      if (!buf) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'One of the photos could not be read' }),
        };
      }
      photoBuffers.push(buf);
    }

    // Insert into Supabase
    const { data: lead, error } = await supabase.from('leads').insert([
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
    ]).select('id').single();

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    // Photos go where the office Camera already looks for a lead's pictures:
    // job-files/customers/<lead id>/. Quote's photos.js lists that folder by
    // lead id, and by lead id alongside customer id once the lead converts, so
    // they show up there with no office-side change.
    //
    // The lead is already saved at this point. A failed upload is logged and
    // counted, never turned into a failed submission: the customer would only
    // send the form again and the office would get the lead twice.
    let photosSaved = 0;
    if (photoBuffers.length) {
      const stamp = Date.now();
      const results = await Promise.all(photoBuffers.map((buf, i) =>
        supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`customers/${lead.id}/${stamp}-${i + 1}.jpg`, buf, { contentType: 'image/jpeg' })
      ));
      results.forEach((r, i) => {
        if (r.error) console.error(`lead-intake: photo ${i + 1} for lead ${lead.id} failed:`, r.error.message);
        else photosSaved++;
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, photosSaved }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
};