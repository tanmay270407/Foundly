import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Client (service_role or anon client on backend)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Create a stable backend Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Gemini Client
const aiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (aiApiKey && aiApiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: aiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. HELPER: Fetch public images and convert to base64 for Gemini multimodal analysis
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string, data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return {
      mimeType,
      data: buffer.toString('base64')
    };
  } catch (err) {
    console.error('[Base64 Fetch] Failed to fetch image:', url, err);
    return null;
  }
}

// 2. API ENDPOINT: Trigger AI Lost/Found Matching
app.post('/api/match/trigger', async (req, res) => {
  const { itemId } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required.' });
  }

  if (!ai) {
    return res.status(503).json({ 
      error: 'AI Matching is temporarily unavailable.',
      details: 'GEMINI_API_KEY is not configured or initialized.' 
    });
  }

  try {
    // Fetch the target item
    const { data: item, error: itemErr } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Item not found in database.', details: itemErr?.message });
    }

    const lostItem = item.type === 'lost' ? item : null;
    const foundItem = item.type === 'found' ? item : null;

    // Candidate filtering: same college, opposite type, matching category, and active status
    const oppositeType = item.type === 'lost' ? 'found' : 'lost';
    const { data: candidates, error: candidateErr } = await supabase
      .from('items')
      .select('*')
      .eq('college_id', item.college_id)
      .eq('type', oppositeType)
      .eq('category', item.category)
      .in('status', ['published', 'approved', 'pending', 'claimed', 'under_review']);

    if (candidateErr) {
      return res.status(500).json({ error: 'Candidate query failed.', details: candidateErr.message });
    }

    if (!candidates || candidates.length === 0) {
      return res.json({ message: 'No eligible candidates in same category and college.', matchesCreated: 0 });
    }

    // Fetch existing matches to prevent duplicates
    const { data: existingMatches, error: matchesErr } = await supabase
      .from('item_matches')
      .select('lost_item_id, found_item_id')
      .or(`lost_item_id.eq.${itemId},found_item_id.eq.${itemId}`);

    const existingPairs = new Set<string>();
    if (existingMatches) {
      existingMatches.forEach((m: any) => {
        existingPairs.add(`${m.lost_item_id}_${m.found_item_id}`);
      });
    }

    // Filter out already matched pairs and self-reports
    const eligibleCandidates = candidates.filter(candidate => {
      const pairKey1 = item.type === 'lost' ? `${itemId}_${candidate.id}` : `${candidate.id}_${itemId}`;
      // Prevent comparing the same user's lost and found item (though typically they are separate users)
      const isSameUser = candidate.user_id === item.user_id;
      return !existingPairs.has(pairKey1) && !isSameUser;
    });

    if (eligibleCandidates.length === 0) {
      return res.json({ message: 'All potential candidates have already been evaluated.', matchesCreated: 0 });
    }

    // Rate / Cost Safety: Max 5 candidates compared per single trigger
    const slicedCandidates = eligibleCandidates.slice(0, 5);
    let matchesCreated = 0;

    for (const candidate of slicedCandidates) {
      const cLost = item.type === 'lost' ? item : candidate;
      const cFound = item.type === 'found' ? item : candidate;

      // Prepare images if available
      let lostImgBase64: { mimeType: string, data: string } | null = null;
      let foundImgBase64: { mimeType: string, data: string } | null = null;

      if (cLost.image_path) {
        lostImgBase64 = await fetchImageAsBase64(cLost.image_path);
      }
      if (cFound.image_path) {
        foundImgBase64 = await fetchImageAsBase64(cFound.image_path);
      }

      // Format prompting inputs
      const contents: any[] = [];
      let promptText = `Analyze whether the following LOST item and FOUND item are a match.

LOST ITEM DETAILS:
- Name: ${cLost.item_name}
- Category: ${cLost.category}
- Description: ${cLost.description}
- Brand: ${cLost.brand || 'Not provided'}
- Color: ${cLost.color || 'Not provided'}
- Unique Marks: ${cLost.unique_marks || 'Not provided'}
- Date Lost: ${cLost.date}
- Approximate Time: ${cLost.approximate_time || 'Not provided'}
- Location Lost: ${cLost.location}

FOUND ITEM DETAILS:
- Name: ${cFound.item_name}
- Category: ${cFound.category}
- Description: ${cFound.description}
- Brand: ${cFound.brand || 'Not provided'}
- Color: ${cFound.color || 'Not provided'}
- Date Found: ${cFound.date}
- Approximate Time: ${cFound.approximate_time || 'Not provided'}
- Location Found: ${cFound.location}

INSTRUCTIONS:
1. Compare visual details, category, brand, color, dates, and locations.
2. If the found date is significantly before the lost date, they are likely not a match.
3. Be logical and distinguish between:
   - Strong evidence (e.g. matching specific scratches, unique sticker descriptions, or serial numbers).
   - Possible evidence (e.g. matching general brand and color).
   - Contradictory evidence (e.g. a Dell laptop and a MacBook, or a red bottle and a blue bottle).
4. Provide a match score from 0 to 100.
5. Provide 2-3 short, concise match reasons.
6. Provide a 1-2 sentence friendly, objective AI match summary.
7. Return valid JSON only, using the specified schema. Do not output any markdown.`;

      // Construct prompt parts
      const parts: any[] = [{ text: promptText }];

      if (lostImgBase64) {
        parts.push({
          inlineData: {
            mimeType: lostImgBase64.mimeType,
            data: lostImgBase64.data
          }
        });
      }

      if (foundImgBase64) {
        parts.push({
          inlineData: {
            mimeType: foundImgBase64.mimeType,
            data: foundImgBase64.data
          }
        });
      }

      contents.push({ parts });

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                is_possible_match: {
                  type: Type.BOOLEAN,
                  description: 'Whether the two items could logically represent the same property.'
                },
                match_score: {
                  type: Type.INTEGER,
                  description: 'Confidence score from 0 (impossible) to 100 (exact match).'
                },
                reasons: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Concise bullet points (max 3) justifying the match outcome.'
                },
                summary: {
                  type: Type.STRING,
                  description: 'Brief user-facing summary paragraph (maximum 1-2 sentences).'
                }
              },
              required: ['is_possible_match', 'match_score', 'reasons', 'summary']
            }
          }
        });

        const textOutput = response.text;
        if (!textOutput) continue;

        const parsed = JSON.parse(textOutput.trim());

        // Validate structure
        if (typeof parsed.is_possible_match !== 'boolean' || typeof parsed.match_score !== 'number') {
          console.warn('[Gemini Parser] Invalid response structure. Skipping pair.');
          continue;
        }

        // Only save matches if score >= 45 or marked possible
        if (parsed.is_possible_match || parsed.match_score >= 45) {
          const { data: matchData, error: matchInsertErr } = await supabase
            .from('item_matches')
            .insert({
              lost_item_id: cLost.id,
              found_item_id: cFound.id,
              college_id: item.college_id,
              match_score: Math.min(Math.max(parsed.match_score, 0), 100),
              match_reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [parsed.summary],
              ai_summary: parsed.summary,
              status: 'SUGGESTED'
            })
            .select()
            .single();

          if (matchInsertErr) {
            console.error('[Match Save Error]', matchInsertErr.message);
            continue;
          }

          matchesCreated++;

          // Send notification to the student who reported the Lost item
          await supabase
            .from('notifications')
            .insert({
              user_id: cLost.user_id,
              college_id: item.college_id,
              title: 'Possible match found',
              message: `We found a potential match (${parsed.match_score}% AI Match) for your lost "${cLost.item_name}".`,
              type: `AI_MATCH_SUGGESTED:${cFound.id}`,
              read: false
            });

          // Send notification to the student who reported the Found item (if any)
          if (cFound.user_id && cFound.user_id !== cLost.user_id) {
            await supabase
              .from('notifications')
              .insert({
                user_id: cFound.user_id,
                college_id: item.college_id,
                title: 'Potential Owner Suggestion',
                message: `AI identified a possible matching lost report for the "${cFound.item_name}" you found.`,
                type: `AI_MATCH_SUGGESTED:${cLost.id}`,
                read: false
              });
          }

          // Write Activity Log
          await supabase
            .from('activity_logs')
            .insert({
              college_id: item.college_id,
              action: 'AI_MATCH_CREATED',
              entity_type: 'ITEM_MATCH',
              entity_id: matchData.id,
              metadata: {
                lost_item_name: cLost.item_name,
                found_item_name: cFound.item_name,
                match_score: parsed.match_score
              }
            });
        }
      } catch (geminiErr: any) {
        console.error('[Gemini AI Processing Error] Skipping candidate pair:', geminiErr.message || geminiErr);
      }
    }

    return res.json({ 
      success: true, 
      message: `Completed processing for ${slicedCandidates.length} potential matches.`, 
      matchesCreated 
    });

  } catch (err: any) {
    console.error('[Matching Trigger Endpoint Error]', err);
    return res.status(500).json({ error: 'Failed to process AI matching trigger.', details: err.message });
  }
});

// Admin Authentication Middleware for backend endpoints
async function authenticateAdmin(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Unauthorized. No authorization token provided.');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new Error('Unauthorized. Invalid token format.');
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    throw new Error('Unauthorized. Invalid or expired authentication token.');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    throw new Error('User profile not found.');
  }

  const isSuspended = profile.avatar_url?.startsWith('[SUSPENDED]');
  if (isSuspended) {
    throw new Error('Unauthorized. Your College Administrator account has been suspended by the platform owner.');
  }

  const normalizedRole = profile.role?.toLowerCase();
  if (normalizedRole !== 'college_admin' && normalizedRole !== 'foundly_owner') {
    throw new Error('Unauthorized. Only campus administrators can perform this action.');
  }

  // Check if college directory is deactivated (only for college_admin role)
  if (normalizedRole === 'college_admin' && profile.college_id) {
    const { data: colData } = await supabase
      .from('colleges')
      .select('*')
      .eq('id', profile.college_id)
      .maybeSingle();

    if (colData?.domain?.startsWith('[DEACTIVATED]')) {
      throw new Error('Unauthorized. Your college directory has been deactivated by the platform owner.');
    }
  }

  return { user, profile };
}

// Platform Owner Authentication Helper for backend endpoints
async function authenticateOwner(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Unauthorized. No authorization token provided.');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new Error('Unauthorized. Invalid token format.');
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    throw new Error('Unauthorized. Invalid or expired authentication token.');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    throw new Error('User profile not found.');
  }

  const normalizedRole = profile.role?.toLowerCase();
  if (normalizedRole !== 'foundly_owner') {
    throw new Error('Unauthorized. Only the Foundly Platform Owner can perform this action.');
  }

  return { user, profile };
}

// 3. API ENDPOINT: Move Claim to Handover
app.post('/api/claim/handover', async (req, res) => {
  const { claimId } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { user, profile } = await authenticateAdmin(req);

    // Fetch claim with item
    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    const isCollegeAdmin = profile.role?.toLowerCase() === 'college_admin';

    // Verify college isolation
    if (isCollegeAdmin && claim.college_id !== profile.college_id) {
      return res.status(403).json({ error: 'Forbidden. This claim belongs to another college.' });
    }

    const currentStatus = claim.status?.toLowerCase();
    if (currentStatus !== 'approved') {
      return res.status(400).json({ error: `Claim must be approved before moving to handover. Current status: ${claim.status}` });
    }

    const timestamp = new Date().toISOString();

    // Perform updates
    const { error: claimUpdateErr } = await supabase
      .from('claims')
      .update({
        status: 'handover',
        handover_at: timestamp
      })
      .eq('id', claimId);

    if (claimUpdateErr) {
      return res.status(500).json({ error: 'Failed to update claim status.', details: claimUpdateErr.message });
    }

    // Update item status to 'handover'
    const { error: itemUpdateErr } = await supabase
      .from('items')
      .update({
        status: 'handover'
      })
      .eq('id', claim.item_id);

    if (itemUpdateErr) {
      console.error('[Handover Item Update Error]', itemUpdateErr);
    }

    // Notify claimant
    await supabase
      .from('notifications')
      .insert({
        user_id: claim.claimant_id,
        college_id: claim.college_id,
        title: 'Ready for handover',
        message: `Your approved claim for "${claim.items?.item_name}" is now ready for physical handover! Please visit the campus office.`,
        type: `HANDOVER_PENDING:${claim.item_id}`,
        read: false
      });

    // Write Activity Log
    await supabase
      .from('activity_logs')
      .insert({
        college_id: claim.college_id,
        actor_id: user.id,
        action: 'CLAIM_MOVED_TO_HANDOVER',
        entity_type: 'CLAIM',
        entity_id: claimId,
        metadata: {
          item_name: claim.items?.item_name,
          admin_email: profile.email
        }
      });

    return res.json({ success: true, message: 'Claim successfully moved to handover.' });

  } catch (err: any) {
    console.error('[Move to Handover Error]', err);
    return res.status(err.message?.includes('Unauthorized') || err.message?.includes('Forbidden') ? 403 : 500).json({ error: err.message || 'Failed to move claim to handover.' });
  }
});

// Helper: Send Return Completion Emails using Resend (Idempotent & Safe)
async function sendReturnEmails(claimId: string) {
  const results = {
    finderEmailSent: false,
    ownerEmailSent: false,
    errors: [] as string[]
  };

  try {
    // 1. Initialize backend-privileged client
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const backendClient = createClient(supabaseUrl, serviceKey);

    // 2. Fetch claim with associated item details
    const { data: claim, error: claimErr } = await backendClient
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      throw new Error(`Claim ${claimId} not found.`);
    }

    // 3. Verify that claim is COMPLETED and item is RETURNED
    if (claim.status?.toLowerCase() !== 'completed') {
      throw new Error(`Claim ${claimId} is not completed (current status: ${claim.status}).`);
    }

    if (claim.items?.status?.toLowerCase() !== 'returned') {
      throw new Error(`Item associated with claim is not returned (current status: ${claim.items?.status}).`);
    }

    // 4. Retrieve claimant/owner profile
    const { data: ownerProfile, error: ownerErr } = await backendClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', claim.claimant_id)
      .single();

    if (ownerErr || !ownerProfile) {
      console.warn(`[Resend Auto] Owner profile not found for claimant ${claim.claimant_id}`);
    }

    // 5. Retrieve finder/reporter profile
    const { data: finderProfile, error: finderErr } = await backendClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', claim.items?.user_id)
      .single();

    if (finderErr || !finderProfile) {
      console.warn(`[Resend Auto] Finder profile not found for reporter ${claim.items?.user_id}`);
    }

    // 6. Check already sent actions in activity_logs to guarantee strict idempotency
    const { data: sentLogs } = await backendClient
      .from('activity_logs')
      .select('action')
      .eq('entity_id', claimId)
      .in('action', ['FINDER_EMAIL_SENT', 'OWNER_EMAIL_SENT']);

    const alreadySentActions = new Set((sentLogs || []).map(l => l.action));

    // Retrieve Resend secrets from server-side environment
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const fromEmail = (process.env.FROM_EMAIL || 'Foundly <onboarding@resend.dev>').trim();

    if (!resendApiKey) {
      const msg = 'RESEND_API_KEY environment variable is not configured. Email skipped.';
      console.warn(`[Resend Auto] ${msg}`);
      results.errors.push(msg);
      return results;
    }

    // A. Send Finder Appreciation Email
    if (finderProfile?.email) {
      if (alreadySentActions.has('FINDER_EMAIL_SENT')) {
        console.log(`[Resend Auto] Finder email already sent previously for claim ${claimId}. Skipping.`);
        results.finderEmailSent = true;
      } else {
        const finderName = finderProfile.full_name || 'there';
        const subject = 'Thank You for Helping Return an Item 🎉';
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333333;">
            <p>Hi ${finderName},</p>
            <p>Thank you for helping someone in your campus community!</p>
            <p>Your honesty and effort helped return a lost item to its rightful owner.</p>
            <p>Thank you for making the Foundly community more helpful and trustworthy.</p>
            <p>Keep spreading the good work! 🎉</p>
            <p style="margin-top: 30px;">— Team Foundly</p>
          </div>
        `;

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [finderProfile.email],
              subject,
              html
            })
          });

          const resBody = await res.json() as any;
          if (res.ok) {
            results.finderEmailSent = true;
            // Write to activity_logs
            await backendClient
              .from('activity_logs')
              .insert({
                college_id: claim.college_id,
                action: 'FINDER_EMAIL_SENT',
                entity_type: 'CLAIM',
                entity_id: claimId,
                metadata: { sent_to: finderProfile.email, resend_id: resBody.id }
              });
          } else {
            const errStr = resBody.message || 'Resend error response';
            results.errors.push(`Finder email send failed: ${errStr}`);
            await backendClient
              .from('activity_logs')
              .insert({
                college_id: claim.college_id,
                action: 'EMAIL_DELIVERY_FAILED',
                entity_type: 'CLAIM',
                entity_id: claimId,
                metadata: { type: 'finder', recipient: finderProfile.email, error: errStr }
              });
          }
        } catch (fetchErr: any) {
          const errStr = fetchErr.message || 'Fetch request failed';
          results.errors.push(`Finder email request failed: ${errStr}`);
          await backendClient
            .from('activity_logs')
            .insert({
              college_id: claim.college_id,
              action: 'EMAIL_DELIVERY_FAILED',
              entity_type: 'CLAIM',
              entity_id: claimId,
              metadata: { type: 'finder', recipient: finderProfile.email, error: errStr }
            });
        }
      }
    }

    // B. Send Owner Successful-Return Email
    if (ownerProfile?.email) {
      if (alreadySentActions.has('OWNER_EMAIL_SENT')) {
        console.log(`[Resend Auto] Owner email already sent previously for claim ${claimId}. Skipping.`);
        results.ownerEmailSent = true;
      } else {
        const ownerName = ownerProfile.full_name || 'there';
        const subject = 'Your Item Has Been Successfully Returned 🎉';
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333333;">
            <p>Hi ${ownerName},</p>
            <p>We're happy to let you know that your reported item has been successfully returned to you.</p>
            <p>Thank you for using Foundly to help reconnect lost items with their rightful owners.</p>
            <p style="margin-top: 30px;">— Team Foundly</p>
          </div>
        `;

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [ownerProfile.email],
              subject,
              html
            })
          });

          const resBody = await res.json() as any;
          if (res.ok) {
            results.ownerEmailSent = true;
            // Write to activity_logs
            await backendClient
              .from('activity_logs')
              .insert({
                college_id: claim.college_id,
                action: 'OWNER_EMAIL_SENT',
                entity_type: 'CLAIM',
                entity_id: claimId,
                metadata: { sent_to: ownerProfile.email, resend_id: resBody.id }
              });
          } else {
            const errStr = resBody.message || 'Resend error response';
            results.errors.push(`Owner email send failed: ${errStr}`);
            await backendClient
              .from('activity_logs')
              .insert({
                college_id: claim.college_id,
                action: 'EMAIL_DELIVERY_FAILED',
                entity_type: 'CLAIM',
                entity_id: claimId,
                metadata: { type: 'owner', recipient: ownerProfile.email, error: errStr }
              });
          }
        } catch (fetchErr: any) {
          const errStr = fetchErr.message || 'Fetch request failed';
          results.errors.push(`Owner email request failed: ${errStr}`);
          await backendClient
            .from('activity_logs')
            .insert({
              college_id: claim.college_id,
              action: 'EMAIL_DELIVERY_FAILED',
              entity_type: 'CLAIM',
              entity_id: claimId,
              metadata: { type: 'owner', recipient: ownerProfile.email, error: errStr }
            });
        }
      }
    }

  } catch (err: any) {
    console.error('[Resend Auto Critical Exception]', err);
    results.errors.push(err.message || 'Unknown critical exception');
  }

  return results;
}

// 4. API ENDPOINT: Confirm Return & Complete Handover
app.post('/api/claim/confirm-return', async (req, res) => {
  const { claimId, handoverNotes } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { user, profile } = await authenticateAdmin(req);

    // Fetch claim with item
    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*, items(*)')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    const isCollegeAdmin = profile.role?.toLowerCase() === 'college_admin';

    // Verify college isolation
    if (isCollegeAdmin && claim.college_id !== profile.college_id) {
      return res.status(403).json({ error: 'Forbidden. This claim belongs to another college.' });
    }

    const currentStatus = claim.status?.toLowerCase();
    if (currentStatus !== 'handover') {
      return res.status(400).json({ error: `Claim must be in handover status. Current status: ${claim.status}` });
    }

    const timestamp = new Date().toISOString();

    // Consistent updates:
    // 1. Update this claim to COMPLETED
    const { error: claimUpdateErr } = await supabase
      .from('claims')
      .update({
        status: 'completed',
        completed_at: timestamp,
        completed_by: user.id,
        handover_notes: handoverNotes || null
      })
      .eq('id', claimId);

    if (claimUpdateErr) {
      return res.status(500).json({ error: 'Failed to complete claim.', details: claimUpdateErr.message });
    }

    // 2. Update item to RETURNED
    const { error: itemUpdateErr } = await supabase
      .from('items')
      .update({
        status: 'returned',
        returned_at: timestamp,
        returned_by: user.id
      })
      .eq('id', claim.item_id);

    if (itemUpdateErr) {
      return res.status(500).json({ error: 'Failed to mark item as returned.', details: itemUpdateErr.message });
    }

    // 3. Reject all other claims for this item
    const { data: otherClaims } = await supabase
      .from('claims')
      .select('id, claimant_id, college_id')
      .eq('item_id', claim.item_id)
      .neq('id', claimId)
      .in('status', ['pending', 'under_review', 'approved', 'handover']);

    if (otherClaims && otherClaims.length > 0) {
      for (const other of otherClaims) {
        await supabase
          .from('claims')
          .update({
            status: 'rejected',
            rejection_reason: 'This item has been successfully returned to another verified claimant.'
          })
          .eq('id', other.id);

        // Notify other claimants
        await supabase
          .from('notifications')
          .insert({
            user_id: other.claimant_id,
            college_id: other.college_id,
            title: 'Claim closed',
            message: `Your claim for "${claim.items?.item_name}" was closed because the item was successfully returned to its verified owner.`,
            type: `CLAIM_REJECTED:${claim.item_id}`,
            read: false
          });
      }
    }

    // 4. Notify this claimant (verified owner)
    await supabase
      .from('notifications')
      .insert({
        user_id: claim.claimant_id,
        college_id: claim.college_id,
        title: 'Item returned successfully',
        message: `Your item "${claim.items?.item_name}" has been marked as returned to you. Thank you for using Foundly!`,
        type: `ITEM_RETURNED:${claim.item_id}`,
        read: false
      });

    // 5. Notify the finder/reporter of the item
    if (claim.items?.user_id && claim.items.user_id !== claim.claimant_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: claim.items.user_id,
          college_id: claim.college_id,
          title: 'Your found report is completed',
          message: `The item "${claim.items?.item_name}" you found has been successfully returned to its owner. Thank you!`,
          type: `ITEM_RETURNED:${claim.item_id}`,
          read: false
        });
    }

    // 6. Write Activity Logs
    await supabase
      .from('activity_logs')
      .insert([
        {
          college_id: claim.college_id,
          actor_id: user.id,
          action: 'ITEM_RETURNED',
          entity_type: 'ITEM',
          entity_id: claim.item_id,
          metadata: { item_name: claim.items?.item_name, admin_email: profile.email }
        },
        {
          college_id: claim.college_id,
          actor_id: user.id,
          action: 'CLAIM_COMPLETED',
          entity_type: 'CLAIM',
          entity_id: claimId,
          metadata: { claimant_id: claim.claimant_id, admin_email: profile.email }
        },
        {
          college_id: claim.college_id,
          actor_id: user.id,
          action: 'CASE_CLOSED',
          entity_type: 'CLAIM',
          entity_id: claimId,
          metadata: { item_name: claim.items?.item_name, admin_email: profile.email }
        }
      ]);

    // 7. Trigger Resend Email Automation Asynchronously (Does not roll back return if Resend fails)
    let emailStatus = null;
    try {
      emailStatus = await sendReturnEmails(claimId);
    } catch (emailErr: any) {
      console.error('[Resend Auto Trigger Failure]', emailErr);
    }

    return res.json({ 
      success: true, 
      message: 'Return confirmed. Case closed. Confirmation emails are being processed.',
      emailStatus
    });

  } catch (err: any) {
    console.error('[Confirm Return Error]', err);
    return res.status(err.message?.includes('Unauthorized') || err.message?.includes('Forbidden') ? 403 : 500).json({ error: err.message || 'Failed to confirm return.' });
  }
});

// 5. API ENDPOINT: Resend Return Completion Emails (Manual Secure Retry)
app.post('/api/send-return-emails', async (req, res) => {
  const { claimId } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'claimId is required.' });
  }

  try {
    const { user, profile } = await authenticateAdmin(req);

    // Fetch claim
    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    const isCollegeAdmin = profile.role?.toLowerCase() === 'college_admin';

    // Verify college isolation
    if (isCollegeAdmin && claim.college_id !== profile.college_id) {
      return res.status(403).json({ error: 'Forbidden. This claim belongs to another college.' });
    }

    // Trigger emails
    const emailStatus = await sendReturnEmails(claimId);

    return res.json({
      success: true,
      message: 'Emails processed.',
      emailStatus
    });

  } catch (err: any) {
    console.error('[Manual Resend API Error]', err);
    return res.status(err.message?.includes('Unauthorized') || err.message?.includes('Forbidden') ? 403 : 500).json({ error: err.message || 'Failed to trigger return emails.' });
  }
});

// Helper to send decision emails to applicants via Resend
async function sendDecisionEmail(params: {
  toEmail: string;
  recipientName: string;
  subject: string;
  html: string;
  collegeId?: string | null;
  action: string;
  requestId: string;
}): Promise<{ emailSent: boolean; emailWarning?: string }> {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromEmail = (process.env.FROM_EMAIL || 'Foundly <onboarding@resend.dev>').trim();

  if (!resendApiKey) {
    const warning = 'Notification email skipped: RESEND_API_KEY is not configured on the server.';
    console.warn(`[Admin Decision Email] ${warning}`);
    return { emailSent: false, emailWarning: warning };
  }

  if (!params.toEmail) {
    return { emailSent: false, emailWarning: 'Applicant has no valid email address on record.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: params.subject,
        html: params.html
      })
    });

    const resBody = await res.json() as any;
    if (!res.ok) {
      const warning = `Email delivery to applicant (${params.toEmail}) failed: ${resBody?.message || res.statusText || 'Resend error'}`;
      console.warn(`[Admin Decision Email] ${warning}`);
      return { emailSent: false, emailWarning: warning };
    }

    // Log email record to activity_logs
    await supabase
      .from('activity_logs')
      .insert({
        college_id: params.collegeId || null,
        action: params.action,
        entity_type: 'ADMIN_REQUEST',
        entity_id: params.requestId,
        metadata: { sent_to: params.toEmail, resend_id: resBody.id }
      });

    return { emailSent: true };
  } catch (err: any) {
    const warning = `Email delivery exception for ${params.toEmail}: ${err.message || 'Network failure'}`;
    console.warn(`[Admin Decision Email] ${warning}`);
    return { emailSent: false, emailWarning: warning };
  }
}

// 5.5. COLLEGE ADMIN APPLICATION SUBMISSION WITH ATOMIC DUPLICATE CHECK
app.post('/api/admin-application/submit', async (req, res) => {
  const {
    fullName,
    email,
    phone,
    staffId,
    collegeName,
    proofFilePath,
    proofFileName,
    statement,
    applicantId
  } = req.body;

  if (!fullName || !email || !collegeName || !statement) {
    return res.status(400).json({ error: 'Missing required application fields.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanPhone = (phone || '').trim();
    const cleanStaffId = (staffId || '').trim();
    const cleanCollegeName = collegeName.trim();
    const cleanStatement = statement.trim();

    // 1. Check if applicant is ALREADY an approved College Admin
    if (applicantId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, colleges(*)')
        .eq('id', applicantId)
        .maybeSingle();

      if (profile && profile.role === 'college_admin') {
        return res.json({
          status: 'ALREADY_APPROVED',
          message: 'Applicant has already been approved as a verified College Administrator.',
          assignedCollegeName: profile.colleges?.name || 'Your Assigned Campus',
          assignedCollegeId: profile.college_id,
          profile
        });
      }
    }

    // Also check if an approved request exists for this applicant_id or email
    let approvedQuery = supabase
      .from('admin_requests')
      .select('*, colleges(*)')
      .eq('status', 'approved');

    if (applicantId) {
      approvedQuery = approvedQuery.or(`applicant_id.eq.${applicantId},email.ilike.${cleanEmail}`);
    } else {
      approvedQuery = approvedQuery.ilike('email', cleanEmail);
    }

    const { data: approvedReq } = await approvedQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (approvedReq) {
      return res.json({
        status: 'ALREADY_APPROVED',
        message: 'Applicant has already been approved as a verified College Administrator.',
        assignedCollegeName: approvedReq.colleges?.name || approvedReq.requested_college_name || 'Your Assigned Campus',
        assignedCollegeId: approvedReq.college_id,
        existingApplication: approvedReq
      });
    }

    // 2. Check for an existing PENDING application (applicantId or email)
    // Enforce: ONE user = maximum ONE active PENDING admin application.
    let pendingQuery = supabase
      .from('admin_requests')
      .select('*, colleges(*)')
      .eq('status', 'pending');

    if (applicantId) {
      pendingQuery = pendingQuery.or(`applicant_id.eq.${applicantId},email.ilike.${cleanEmail}`);
    } else {
      pendingQuery = pendingQuery.ilike('email', cleanEmail);
    }

    const { data: existingPending, error: pendingErr } = await pendingQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return res.json({
        status: 'ALREADY_PENDING',
        message: 'You already have a College Admin application under review.',
        existingApplication: existingPending
      });
    }

    // 3. Format structured reason metadata
    const formattedReason = [
      `[Campus: ${cleanCollegeName}]`,
      `[Staff ID: ${cleanStaffId}]`,
      '',
      'Role & Statement of Intent:',
      cleanStatement
    ].join('\n');

    // 4. Resolve a holding college_id reference if required by database schema
    let matchedCollegeId = null;
    const { data: colleges } = await supabase.from('colleges').select('id, name, code');
    if (colleges && colleges.length > 0) {
      const match = colleges.find(c => 
        c.name.trim().toLowerCase() === cleanCollegeName.toLowerCase() ||
        c.code.trim().toLowerCase() === cleanCollegeName.toLowerCase()
      );
      matchedCollegeId = match ? match.id : colleges[0].id;
    }

    // 5. Insert new application (status = 'pending')
    // Previous rejected requests are preserved and untouched.
    const basePayload: any = {
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      college_proof_path: proofFilePath || null,
      reason: formattedReason,
      status: 'pending'
    };

    if (applicantId) {
      basePayload.applicant_id = applicantId;
    }
    if (matchedCollegeId) {
      basePayload.college_id = matchedCollegeId;
    }

    const extendedPayload = {
      ...basePayload,
      requested_college_name: cleanCollegeName,
      staff_id: cleanStaffId,
      representative_id: cleanStaffId,
      proof_information: proofFileName || null
    };

    let insertedRecord = null;
    const tryExtended = await supabase
      .from('admin_requests')
      .insert(extendedPayload)
      .select('*, colleges(*)')
      .single();

    if (tryExtended.error) {
      // Check if duplicate constraint violated (e.g. concurrent race condition / double-click)
      if (
        tryExtended.error.code === '23505' || 
        tryExtended.error.message?.includes('unique') || 
        tryExtended.error.message?.includes('duplicate')
      ) {
        const { data: conflictRow } = await pendingQuery.limit(1).maybeSingle();
        return res.json({
          status: 'ALREADY_PENDING',
          message: 'You already have a College Admin application under review.',
          existingApplication: conflictRow || {
            requested_college_name: cleanCollegeName,
            status: 'pending',
            created_at: new Date().toISOString()
          }
        });
      }

      // If extended columns missing, fallback to base
      const tryBase = await supabase
        .from('admin_requests')
        .insert(basePayload)
        .select('*, colleges(*)')
        .single();

      if (tryBase.error) {
        if (
          tryBase.error.code === '23505' || 
          tryBase.error.message?.includes('unique') || 
          tryBase.error.message?.includes('duplicate')
        ) {
          const { data: conflictRow } = await pendingQuery.limit(1).maybeSingle();
          return res.json({
            status: 'ALREADY_PENDING',
            message: 'You already have a College Admin application under review.',
            existingApplication: conflictRow || {
              requested_college_name: cleanCollegeName,
              status: 'pending',
              created_at: new Date().toISOString()
            }
          });
        }
        throw tryBase.error;
      }
      insertedRecord = tryBase.data;
    } else {
      insertedRecord = tryExtended.data;
    }

    return res.json({
      status: 'SUCCESS',
      message: 'Your College Admin application has been submitted and is under review.',
      application: insertedRecord
    });
  } catch (err: any) {
    console.error('[Admin Application Submit Error]', err);
    return res.status(500).json({ error: err.message || 'Failed to submit application.' });
  }
});

// 6. PLATFORM OWNER SECURE API ENDPOINTS

// Get All Admin Requests for Owner
app.get('/api/owner/admin-requests', async (req, res) => {
  try {
    await authenticateOwner(req);
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*, colleges(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ requests: data || [] });
  } catch (err: any) {
    console.error('[Get Admin Requests Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to retrieve admin requests.' });
  }
});

// Approve Admin Application
app.post('/api/owner/approve-admin', async (req, res) => {
  const { requestId, collegeId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Fetch the request
    const { data: request, error: reqErr } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      return res.status(404).json({ error: 'Admin request application not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    }

    const targetCollegeId = collegeId || request.college_id;
    if (!targetCollegeId) {
      return res.status(400).json({ error: 'A college campus assignment is required to approve this application.' });
    }

    // Fetch assigned college details
    const { data: collegeObj } = await supabase
      .from('colleges')
      .select('id, name, code')
      .eq('id', targetCollegeId)
      .single();

    const assignedCollegeName = collegeObj?.name || 'Assigned Campus Directory';
    const timestamp = new Date().toISOString();

    // 1. Update the admin_request status to approved and assign college_id
    const updatePayload: any = {
      status: 'approved',
      college_id: targetCollegeId,
      reviewed_by: user.id,
      reviewed_at: timestamp
    };

    const { error: updateErr } = await supabase
      .from('admin_requests')
      .update(updatePayload)
      .eq('id', requestId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to approve admin application.', details: updateErr.message });
    }

    // 2. Promote applicant to college_admin in profiles table
    if (request.applicant_id) {
      await supabase
        .from('profiles')
        .update({
          role: 'college_admin',
          college_id: targetCollegeId,
          updated_at: timestamp
        })
        .eq('id', request.applicant_id);
    }

    // 3. Insert in-app notification for the applicant
    if (request.applicant_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: request.applicant_id,
          college_id: targetCollegeId,
          type: 'CLAIM_UPDATE',
          title: 'Application Approved 🎉',
          message: `Your application to become a verified College Administrator for ${assignedCollegeName} has been approved. You now have access to the Admin Panel!`,
          link: '/admin'
        });
    }

    // 4. Log the activity record
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: targetCollegeId,
        action: 'ADMIN_PROMOTED',
        entity_type: 'ADMIN_REQUEST',
        entity_id: requestId,
        metadata: { 
          applicant_name: request.full_name, 
          applicant_email: request.email, 
          assigned_college_id: targetCollegeId,
          assigned_college_name: assignedCollegeName
        }
      });

    // 5. Send approval email to ORIGINAL APPLICANT EMAIL only after DB operations succeed
    const approvalHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #4f46e5; margin-top: 0; font-size: 22px;">Congratulations, ${request.full_name || 'Administrator'}! 🎉</h2>
        <p>We are pleased to inform you that your application to become a verified <strong>College Administrator</strong> has been <strong>approved</strong> by the Foundly Platform Owner.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Assigned Campus Directory</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #0f172a;">${assignedCollegeName} (${collegeObj?.code || 'CAMP'})</p>
        </div>
        <p>Your account permissions have been upgraded. You now have full administrative access to manage campus lost &amp; found items, resolve student ownership claims, configure secure storage locations, and oversee campus operations.</p>
        <p style="margin: 28px 0;">
          <a href="${process.env.APP_URL || 'https://foundly.app'}/admin" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">Open College Admin Portal</a>
        </p>
        <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Thank you for keeping your campus community organized and connected.<br/>
          — Team Foundly
        </p>
      </div>
    `;

    const emailResult = await sendDecisionEmail({
      toEmail: request.email,
      recipientName: request.full_name,
      subject: `Foundly College Administrator Application Approved — ${assignedCollegeName} 🎉`,
      html: approvalHtml,
      collegeId: targetCollegeId,
      action: 'ADMIN_APPROVAL_EMAIL_SENT',
      requestId: requestId
    });

    return res.json({ 
      success: true, 
      message: 'Admin request approved and user promoted successfully.',
      assignedCollegeId: targetCollegeId,
      assignedCollegeName: assignedCollegeName,
      emailSent: emailResult.emailSent,
      emailWarning: emailResult.emailWarning
    });
  } catch (err: any) {
    console.error('[Approve Admin Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to approve admin request.' });
  }
});

// Reject Admin Application
app.post('/api/owner/reject-admin', async (req, res) => {
  const { requestId, reason } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Fetch the request
    const { data: request, error: reqErr } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      return res.status(404).json({ error: 'Admin request application not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    }

    const timestamp = new Date().toISOString();
    const rejectionReasonText = reason?.trim() || 'Credentials could not be verified';

    // Extract requested campus name
    const requestedCampus = request.requested_college_name ||
      (request.reason?.match(/\[Campus:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
      'the requested institution';

    // 1. Update the request to rejected
    const { error: updateErr } = await supabase
      .from('admin_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: timestamp,
        rejection_reason: rejectionReasonText
      })
      .eq('id', requestId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to reject admin application.', details: updateErr.message });
    }

    // 2. Insert notification for the user
    if (request.applicant_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: request.applicant_id,
          college_id: request.college_id || null,
          type: 'CLAIM_UPDATE',
          title: 'Application Update',
          message: `Your administrator application was declined.${reason ? ` Reason: ${reason.trim()}` : ''}`,
          link: '/admin-application'
        });
    }

    // 3. Log the activity record
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: request.college_id || null,
        action: 'ADMIN_REJECTED',
        entity_type: 'ADMIN_REQUEST',
        entity_id: requestId,
        metadata: { 
          applicant_name: request.full_name, 
          applicant_email: request.email, 
          requested_college: requestedCampus,
          reason: rejectionReasonText 
        }
      });

    // 4. Send rejection email to ORIGINAL APPLICANT EMAIL only after DB operations succeed
    const rejectionHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; line-height: 1.6; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #334155; margin-top: 0; font-size: 20px;">Foundly Administrator Application Update</h2>
        <p>Hello ${request.full_name || 'Applicant'},</p>
        <p>Thank you for submitting your application to serve as a College Administrator for <strong>${requestedCampus}</strong> on Foundly.</p>
        <p>After reviewing the provided documentation and institutional credentials, we are unable to approve your application at this time.</p>
        ${reason ? `
        <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 14px 16px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; font-size: 12px; color: #9f1239; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Reason for Decision</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #881337;">${reason.trim()}</p>
        </div>
        ` : ''}
        <p>If you believe this decision was made in error or if you have updated staff credentials or verification documents, you are welcome to submit a revised application or contact our team.</p>
        <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Warm regards,<br/>
          — Team Foundly
        </p>
      </div>
    `;

    const emailResult = await sendDecisionEmail({
      toEmail: request.email,
      recipientName: request.full_name,
      subject: `Foundly Administrator Application Status — ${requestedCampus}`,
      html: rejectionHtml,
      collegeId: request.college_id,
      action: 'ADMIN_REJECTION_EMAIL_SENT',
      requestId: requestId
    });

    return res.json({ 
      success: true, 
      message: 'Admin request rejected successfully.',
      emailSent: emailResult.emailSent,
      emailWarning: emailResult.emailWarning
    });
  } catch (err: any) {
    console.error('[Reject Admin Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to reject admin request.' });
  }
});

// Suspend College Admin
app.post('/api/owner/suspend-admin', async (req, res) => {
  const { adminId } = req.body;
  if (!adminId) {
    return res.status(400).json({ error: 'adminId is required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Fetch the target admin profile
    const { data: adminProfile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminId)
      .single();

    if (profErr || !adminProfile) {
      return res.status(404).json({ error: 'Admin profile not found.' });
    }

    let originalAvatar = adminProfile.avatar_url || '';
    if (originalAvatar.startsWith('[SUSPENDED]')) {
      return res.status(400).json({ error: 'Admin is already suspended.' });
    }

    const suspendedAvatar = `[SUSPENDED]${originalAvatar}`;

    // Update their avatar_url to encode suspension state securely
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: suspendedAvatar })
      .eq('id', adminId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to suspend admin profile.', details: updateErr.message });
    }

    // Insert notification
    await supabase
      .from('notifications')
      .insert({
        user_id: adminId,
        college_id: adminProfile.college_id,
        type: 'CLAIM_UPDATE',
        title: 'Account Suspended',
        message: 'Your College Administrator status has been suspended by the platform owner.',
        link: '/student'
      });

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: adminProfile.college_id,
        action: 'ADMIN_SUSPENDED',
        entity_type: 'PROFILE',
        entity_id: adminId,
        metadata: { admin_name: adminProfile.full_name, admin_email: adminProfile.email }
      });

    return res.json({ success: true, message: 'Administrator suspended successfully.' });
  } catch (err: any) {
    console.error('[Suspend Admin Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to suspend admin.' });
  }
});

// Reactivate College Admin
app.post('/api/owner/reactivate-admin', async (req, res) => {
  const { adminId } = req.body;
  if (!adminId) {
    return res.status(400).json({ error: 'adminId is required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Fetch the profile
    const { data: adminProfile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminId)
      .single();

    if (profErr || !adminProfile) {
      return res.status(404).json({ error: 'Admin profile not found.' });
    }

    let currentAvatar = adminProfile.avatar_url || '';
    if (!currentAvatar.startsWith('[SUSPENDED]')) {
      return res.status(400).json({ error: 'Admin is not suspended.' });
    }

    const reactivatedAvatar = currentAvatar.replace('[SUSPENDED]', '');

    // Update avatar_url to remove suspension code
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: reactivatedAvatar || null })
      .eq('id', adminId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to reactivate admin profile.', details: updateErr.message });
    }

    // Insert notification
    await supabase
      .from('notifications')
      .insert({
        user_id: adminId,
        college_id: adminProfile.college_id,
        type: 'CLAIM_UPDATE',
        title: 'Account Reactivated 🎉',
        message: 'Your College Administrator status has been successfully reactivated. Welcome back!',
        link: '/admin'
      });

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: adminProfile.college_id,
        action: 'ADMIN_REACTIVATED',
        entity_type: 'PROFILE',
        entity_id: adminId,
        metadata: { admin_name: adminProfile.full_name, admin_email: adminProfile.email }
      });

    return res.json({ success: true, message: 'Administrator status reactivated successfully.' });
  } catch (err: any) {
    console.error('[Reactivate Admin Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to reactivate admin.' });
  }
});

// Create New College Campus
app.post('/api/owner/create-college', async (req, res) => {
  const { name, code, domain, city, state } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'College name and short code are required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Insert college - try with domain first, fallback without domain if column missing
    const insertPayload: any = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      city: city?.trim() || null,
      state: state?.trim() || null
    };
    if (domain?.trim()) {
      insertPayload.domain = domain.trim();
    }

    let { data: newCollege, error: colErr } = await supabase
      .from('colleges')
      .insert(insertPayload)
      .select()
      .single();

    if (colErr && (colErr.message?.includes('column') || colErr.code === '42703')) {
      delete insertPayload.domain;
      const fallbackResult = await supabase
        .from('colleges')
        .insert(insertPayload)
        .select()
        .single();
      newCollege = fallbackResult.data;
      colErr = fallbackResult.error;
    }

    if (colErr) {
      return res.status(500).json({ error: 'Failed to register college campus.', details: colErr.message });
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: newCollege.id,
        action: 'COLLEGE_CREATED',
        entity_type: 'COLLEGE',
        entity_id: newCollege.id,
        metadata: { college_name: newCollege.name, college_code: newCollege.code }
      });

    return res.json({ success: true, college: newCollege });
  } catch (err: any) {
    console.error('[Create College Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to register college.' });
  }
});

// Toggle College Activation
app.post('/api/owner/toggle-college', async (req, res) => {
  const { collegeId, isDeactivating } = req.body;
  if (!collegeId) {
    return res.status(400).json({ error: 'collegeId is required.' });
  }

  try {
    const { user, profile } = await authenticateOwner(req);

    // Fetch college
    const { data: college, error: colErr } = await supabase
      .from('colleges')
      .select('*')
      .eq('id', collegeId)
      .single();

    if (colErr || !college) {
      return res.status(404).json({ error: 'College not found.' });
    }

    let currentDomain = college.domain || '';
    let updatedDomain = currentDomain;

    if (isDeactivating) {
      if (!currentDomain.startsWith('[DEACTIVATED]')) {
        updatedDomain = `[DEACTIVATED]${currentDomain}`;
      }
    } else {
      if (currentDomain.startsWith('[DEACTIVATED]')) {
        updatedDomain = currentDomain.replace('[DEACTIVATED]', '');
      }
    }

    // Update domain if column exists
    const { error: updateErr } = await supabase
      .from('colleges')
      .update({ domain: updatedDomain || null })
      .eq('id', collegeId);

    if (updateErr && !(updateErr.message?.includes('column') || updateErr.code === '42703')) {
      return res.status(500).json({ error: 'Failed to update college status.', details: updateErr.message });
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        actor_id: user.id,
        college_id: collegeId,
        action: isDeactivating ? 'COLLEGE_DEACTIVATED' : 'COLLEGE_ACTIVATED',
        entity_type: 'COLLEGE',
        entity_id: collegeId,
        metadata: { college_name: college.name, domain: updatedDomain }
      });

    return res.json({ success: true, domain: updatedDomain });
  } catch (err: any) {
    console.error('[Toggle College Error]', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 500).json({ error: err.message || 'Failed to update college status.' });
  }
});

// Bootstrapping Vite dev / production modes
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Foundly Server] Full-stack engine listening on http://localhost:${PORT}`);
  });
}

startServer();
