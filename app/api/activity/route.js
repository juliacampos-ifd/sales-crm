import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  try {
    const sb = createServerClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const { data: logins, error: logErr } = await sb
      .from('login_logs')
      .select('user_id,email,name,logged_at')
      .gte('logged_at', sinceISO)
      .order('logged_at', { ascending: false });
    if (logErr) console.error('login_logs error:', logErr.message);

    const { data: history, error: histErr } = await sb
      .from('pipeline_history')
      .select('changed_by,changed_by_name,created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false });
    if (histErr) console.error('pipeline_history error:', histErr.message);

    const { data: profiles, error: profErr } = await sb
      .from('profiles')
      .select('id,name,email,role,team');
    if (profErr) console.error('profiles error:', profErr.message);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    const userActivity = {};

    const ensureUser = (userId, email, name) => {
      if (!userActivity[userId]) {
        const prof = profileMap[userId];
        userActivity[userId] = {
          name: prof?.name || name || email || 'Unknown',
          email: prof?.email || email || '',
          role: prof?.role || '',
          team: prof?.team || '',
          logins_total: 0,
          logins_week: 0,
          last_login: null,
          movements_total: 0,
          movements_week: 0,
          last_movement: null,
        };
      }
    };

    (logins || []).forEach(l => {
      if (!l.user_id) return;
      ensureUser(l.user_id, l.email, l.name);
      const u = userActivity[l.user_id];
      u.logins_total++;
      if (l.logged_at >= weekAgoISO) u.logins_week++;
      if (!u.last_login || l.logged_at > u.last_login) u.last_login = l.logged_at;
    });

    (history || []).forEach(h => {
      if (!h.changed_by) return;
      ensureUser(h.changed_by, null, h.changed_by_name);
      const u = userActivity[h.changed_by];
      u.movements_total++;
      if (h.created_at >= weekAgoISO) u.movements_week++;
      if (!u.last_movement || h.created_at > u.last_movement) u.last_movement = h.created_at;
    });

    (profiles || []).forEach(p => {
      if (!userActivity[p.id]) {
        userActivity[p.id] = {
          name: p.name,
          email: p.email,
          role: p.role,
          team: p.team,
          logins_total: 0,
          logins_week: 0,
          last_login: null,
          movements_total: 0,
          movements_week: 0,
          last_movement: null,
        };
      }
    });

    const users = Object.entries(userActivity)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        const aLast = a.last_login > a.last_movement ? a.last_login : a.last_movement;
        const bLast = b.last_login > b.last_movement ? b.last_login : b.last_movement;
        if (!aLast && !bLast) return 0;
        if (!aLast) return 1;
        if (!bLast) return -1;
        return bLast > aLast ? 1 : -1;
      });

    const res = NextResponse.json({ users, _ts: new Date().toISOString() });
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('CDN-Cache-Control', 'no-store');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
