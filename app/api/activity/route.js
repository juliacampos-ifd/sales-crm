import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  try {
    const sb = createServerClient();

    // Last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString();

    // 7 days ago for "this week"
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    // 1. Fetch login logs (last 30 days)
    const { data: logins, error: logErr } = await sb
      .from('login_logs')
      .select('user_id,email,name,logged_at')
      .gte('logged_at', sinceISO)
      .order('logged_at', { ascending: false });
    if (logErr) throw logErr;

    // 2. Fetch pipeline_history (last 30 days) for movement count
    const { data: history, error: histErr } = await sb
      .from('pipeline_history')
      .select('user_id,changed_by_name,created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false });
    if (histErr) throw histErr;

    // 3. Fetch profiles to map user_id -> name
    const { data: profiles } = await sb
      .from('profiles')
      .select('id,name,email,role,team');

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // 4. Build per-user activity summary
    const userActivity = {};

    const ensureUser = (userId, email, name) => {
      if (!userActivity[userId]) {
        const prof = profileMap[userId];
        userActivity[userId] = {
          name: prof?.name || name || email,
          email: prof?.email || email,
          role: prof?.role || '—',
          team: prof?.team || '—',
          logins_total: 0,
          logins_week: 0,
          last_login: null,
          movements_total: 0,
          movements_week: 0,
          last_movement: null,
        };
      }
    };

    // Count logins
    (logins || []).forEach(l => {
      if (!l.user_id) return;
      ensureUser(l.user_id, l.email, l.name);
      const u = userActivity[l.user_id];
      u.logins_total++;
      if (l.logged_at >= weekAgoISO) u.logins_week++;
      if (!u.last_login || l.logged_at > u.last_login) u.last_login = l.logged_at;
    });

    // Count movements
    (history || []).forEach(h => {
      if (!h.user_id) return;
      ensureUser(h.user_id, null, h.changed_by_name);
      const u = userActivity[h.user_id];
      u.movements_total++;
      if (h.created_at >= weekAgoISO) u.movements_week++;
      if (!u.last_movement || h.created_at > u.last_movement) u.last_movement = h.created_at;
    });

    // Also include profiles that have NO activity (to show who never logged in)
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

    // Convert to sorted array
    const users = Object.entries(userActivity)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        // Sort by last activity (login or movement), most recent first
        const aLast = a.last_login > a.last_movement ? a.last_login : a.last_movement;
        const bLast = b.last_login > b.last_movement ? b.last_login : b.last_movement;
        if (!aLast && !bLast) return 0;
        if (!aLast) return 1;
        if (!bLast) return -1;
        return bLast > aLast ? 1 : -1;
      });

    const res = NextResponse.json({
      users,
      _ts: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('CDN-Cache-Control', 'no-store');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
