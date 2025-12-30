// Social Media Auto-Publisher API
// Story 16.2: Admin Tool for social media publishing
// ACs: 1-10 (Platforms, Content Types, Auto-publishing, Formatting, OAuth, Draft, Analytics, Scheduling, Team, Compliance)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) return null;
    
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    return user;
  }
  
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Check if user is admin team member
async function checkTeamAccess(userId: string, permission?: string) {
  const supabase = getSupabaseClient();
  
  if (permission) {
    const { data } = await supabase.rpc('check_social_permission', {
      p_user_id: userId,
      p_permission: permission
    });
    return data === true;
  }
  
  const { data: member } = await supabase
    .from('social_team_members')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
    
  return !!member;
}

// Platform OAuth configurations (AC 5)
const OAUTH_CONFIGS: Record<string, {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}> = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube']
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish']
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement']
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read']
  },
  telegram: {
    authUrl: '', // Telegram uses bot tokens
    tokenUrl: '',
    scopes: []
  }
};

// Platform formatting rules (AC 4)
function formatForPlatform(platform: string, content: {
  title: string;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
  disclaimer?: string;
}): Record<string, unknown> {
  const { title, caption, hashtags, mediaUrls, disclaimer } = content;
  const hashtagString = hashtags.slice(0, 30).join(' ');
  
  switch (platform) {
    case 'youtube':
      return {
        snippet: {
          title: title.slice(0, 100),
          description: `${caption}

${hashtagString}${disclaimer ? `

${disclaimer}` : ''}`,
          tags: hashtags.slice(0, 50),
          categoryId: '27' // Education
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      };
      
    case 'instagram':
      return {
        caption: `${caption.slice(0, 2000)}\n\n${hashtagString.slice(0, 200)}`,
        mediaType: mediaUrls[0]?.includes('.mp4') ? 'REELS' : 'IMAGE',
        shareToFeed: true,
        coverUrl: mediaUrls[1] // Thumbnail
      };
      
    case 'facebook':
      return {
        message: `${title}

${caption.slice(0, 1000)}

${hashtagString}${disclaimer ? `

${disclaimer}` : ''}`,
        link: mediaUrls[0],
        published: true
      };
      
    case 'twitter':
      // 280 char limit
      const tweetText = `${title.slice(0, 100)}\n\n${caption.slice(0, 120)}`;
      return {
        text: tweetText.slice(0, 280),
        media: { media_ids: [] }, // Would be populated after upload
        poll: null
      };
      
    case 'telegram':
      return {
        chat_id: '', // Channel ID
        caption: `*${title}*

${caption.slice(0, 800)}

${hashtagString}`,
        parse_mode: 'Markdown',
        disable_notification: false
      };
      
    default:
      return { title, caption, hashtags };
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const hasAccess = await checkTeamAccess(user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';
    const supabase = getSupabaseClient();
    
    switch (action) {
      // Get dashboard overview
      case 'dashboard': {
        const { data, error } = await supabase.rpc('get_social_dashboard', {
          p_user_id: user.id
        });
        
        if (error) throw error;
        return NextResponse.json(data);
      }
      
      // Get all platforms (AC 1)
      case 'platforms': {
        const { data: platforms, error } = await supabase
          .from('social_platforms')
          .select('*')
          .eq('is_active', true);
          
        if (error) throw error;
        return NextResponse.json({ platforms });
      }
      
      // Get connected accounts (AC 5)
      case 'accounts': {
        const { data: accounts, error } = await supabase
          .from('social_connected_accounts')
          .select(`
            *,
            platform:social_platforms(*)
          `)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return NextResponse.json({ accounts });
      }
      
      // Get content types (AC 2)
      case 'content-types': {
        const { data: types, error } = await supabase
          .from('social_content_types')
          .select('*')
          .eq('is_active', true);
          
        if (error) throw error;
        return NextResponse.json({ content_types: types });
      }
      
      // Get posts with filters
      case 'posts': {
        const status = searchParams.get('status');
        const platformId = searchParams.get('platform');
        const limit = parseInt(searchParams.get('limit') || '50');
        
        let query = supabase
          .from('social_posts')
          .select(`
            *,
            platform:social_platforms(*),
            account:social_connected_accounts(account_name, account_handle),
            content_type:social_content_types(name, slug),
            analytics:social_post_analytics(*)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (status) query = query.eq('status', status);
        if (platformId) query = query.eq('platform_id', platformId);
        
        const { data: posts, error } = await query;
        if (error) throw error;
        
        return NextResponse.json({ posts });
      }
      
      // Get single post
      case 'post': {
        const postId = searchParams.get('id');
        if (!postId) {
          return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
        }
        
        const { data: post, error } = await supabase
          .from('social_posts')
          .select(`
            *,
            platform:social_platforms(*),
            account:social_connected_accounts(*),
            content_type:social_content_types(*),
            analytics:social_post_analytics(*)
          `)
          .eq('id', postId)
          .single();
          
        if (error) throw error;
        return NextResponse.json({ post });
      }
      
      // Get scheduled posts (AC 8)
      case 'scheduled': {
        const { data: scheduled, error } = await supabase
          .from('social_posts')
          .select(`
            *,
            platform:social_platforms(name, slug, icon),
            account:social_connected_accounts(account_name)
          `)
          .eq('status', 'scheduled')
          .gt('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });
          
        if (error) throw error;
        return NextResponse.json({ scheduled });
      }
      
      // Get drafts for review (AC 6)
      case 'drafts': {
        const { data: drafts, error } = await supabase
          .from('social_posts')
          .select(`
            *,
            platform:social_platforms(*),
            content_type:social_content_types(*)
          `)
          .eq('status', 'draft')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return NextResponse.json({ drafts });
      }
      
      // Get analytics (AC 7)
      case 'analytics': {
        const postId = searchParams.get('post_id');
        const days = parseInt(searchParams.get('days') || '30');
        
        if (postId) {
          const { data: analytics, error } = await supabase
            .from('social_post_analytics')
            .select('*')
            .eq('post_id', postId)
            .single();
            
          if (error) throw error;
          return NextResponse.json({ analytics });
        }
        
        // Aggregate analytics
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const { data: posts, error } = await supabase
          .from('social_posts')
          .select(`
            id,
            title,
            platform:social_platforms(name, slug),
            published_at,
            analytics:social_post_analytics(views, likes, comments, shares, engagement_rate)
          `)
          .eq('status', 'published')
          .gte('published_at', startDate.toISOString())
          .order('published_at', { ascending: false });
          
        if (error) throw error;
        
        // Calculate totals
        const totals = posts?.reduce((acc, post) => {
          const analytics = post.analytics?.[0] || {};
          return {
            views: acc.views + (analytics.views || 0),
            likes: acc.likes + (analytics.likes || 0),
            comments: acc.comments + (analytics.comments || 0),
            shares: acc.shares + (analytics.shares || 0)
          };
        }, { views: 0, likes: 0, comments: 0, shares: 0 });
        
        return NextResponse.json({
          posts,
          totals,
          period_days: days
        });
      }
      
      // Get team members (AC 9)
      case 'team': {
        const { data: team, error } = await supabase
          .from('social_team_members')
          .select(`
            *,
            user:auth.users(email)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        return NextResponse.json({ team });
      }
      
      // Get OAuth URL (AC 5)
      case 'oauth-url': {
        const platform = searchParams.get('platform');
        if (!platform || !OAUTH_CONFIGS[platform]) {
          return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
        }
        
        const config = OAUTH_CONFIGS[platform];
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback`;
        const state = Buffer.from(JSON.stringify({ 
          platform, 
          userId: user.id,
          timestamp: Date.now()
        })).toString('base64');
        
        if (platform === 'telegram') {
          // Telegram uses bot tokens instead of OAuth
          return NextResponse.json({
            type: 'bot_token',
            instructions: 'Enter your Telegram Bot Token to connect'
          });
        }
        
        const authUrl = new URL(config.authUrl);
        authUrl.searchParams.set('client_id', process.env[`${platform.toUpperCase()}_CLIENT_ID`] || '');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', config.scopes.join(' '));
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('access_type', 'offline');
        
        return NextResponse.json({ auth_url: authUrl.toString() });
      }
      
      // Get optimal posting times (AC 8)
      case 'optimal-times': {
        const platform = searchParams.get('platform');
        
        const { data: platforms, error } = await supabase
          .from('social_platforms')
          .select('slug, optimal_posting_hours')
          .eq(platform ? 'slug' : 'is_active', platform || true);
          
        if (error) throw error;
        
        const times = platforms?.reduce((acc, p) => {
          acc[p.slug] = p.optimal_posting_hours;
          return acc;
        }, {} as Record<string, number[]>);
        
        return NextResponse.json({ optimal_times: times });
      }
      
      // Get disclaimers (AC 10)
      case 'disclaimers': {
        const { data: disclaimers, error } = await supabase
          .from('social_disclaimers')
          .select(`
            *,
            platform:social_platforms(name, slug),
            content_type:social_content_types(name, slug)
          `)
          .eq('is_active', true);
          
        if (error) throw error;
        return NextResponse.json({ disclaimers });
      }
      
      // Get publishing queue
      case 'queue': {
        const { data: queue, error } = await supabase
          .from('social_publishing_queue')
          .select(`
            *,
            post:social_posts(
              id, title, status,
              platform:social_platforms(name, slug)
            )
          `)
          .in('status', ['pending', 'processing'])
          .order('next_attempt_at', { ascending: true })
          .limit(50);
          
        if (error) throw error;
        return NextResponse.json({ queue });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Social API GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const hasAccess = await checkTeamAccess(user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }
    
    const body = await request.json();
    const { action } = body;
    const supabase = getSupabaseClient();
    
    switch (action) {
      // Create new post (AC 3)
      case 'create-post': {
        const {
          content_type_slug,
          source_id,
          title,
          caption,
          media_urls,
          scheduled_at,
          platform_id,
          as_draft
        } = body;
        
        // Get platform
        const { data: platform } = await supabase
          .from('social_platforms')
          .select('*')
          .eq('id', platform_id)
          .single();
          
        if (!platform) {
          return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
        }
        
        // Get content type
        const { data: contentType } = await supabase
          .from('social_content_types')
          .select('*')
          .eq('slug', content_type_slug)
          .single();
        
        // Get disclaimer (AC 10)
        const { data: disclaimer } = await supabase
          .from('social_disclaimers')
          .select('disclaimer_text')
          .eq('platform_id', platform_id)
          .eq('is_active', true)
          .single();
        
        // Get connected account
        const { data: account } = await supabase
          .from('social_connected_accounts')
          .select('id')
          .eq('platform_id', platform_id)
          .eq('status', 'active')
          .single();
        
        // Format content for platform (AC 4)
        const formatted = formatForPlatform(platform.slug, {
          title,
          caption,
          hashtags: contentType?.hashtag_template || [],
          mediaUrls: media_urls || [],
          disclaimer: disclaimer?.disclaimer_text
        });
        
        // Create post
        const { data: post, error } = await supabase
          .from('social_posts')
          .insert({
            content_type_id: contentType?.id,
            source_content_id: source_id,
            source_content_type: content_type_slug,
            title,
            caption,
            hashtags: contentType?.hashtag_template,
            media_urls,
            platform_id,
            account_id: account?.id,
            formatted_content: formatted,
            disclaimer: disclaimer?.disclaimer_text,
            status: as_draft ? 'draft' : 'scheduled',
            scheduled_at: scheduled_at || new Date(Date.now() + 3600000).toISOString(),
            created_by: user.id
          })
          .select()
          .single();
          
        if (error) throw error;
        
        // Add to queue if scheduled
        if (!as_draft && post) {
          await supabase
            .from('social_publishing_queue')
            .insert({
              post_id: post.id,
              next_attempt_at: post.scheduled_at
            });
        }
        
        return NextResponse.json({ success: true, post });
      }
      
      // Schedule post with auto-creation (AC 3)
      case 'schedule': {
        const { content_type_slug, source_id, title, caption, media_urls, scheduled_at } = body;
        
        const { data, error } = await supabase.rpc('schedule_social_post', {
          p_content_type_slug: content_type_slug,
          p_source_id: source_id,
          p_title: title,
          p_caption: caption,
          p_media_urls: media_urls,
          p_scheduled_at: scheduled_at,
          p_created_by: user.id
        });
        
        if (error) throw error;
        return NextResponse.json(data);
      }
      
      // Update post
      case 'update-post': {
        const { post_id, ...updates } = body;
        
        const canSchedule = await checkTeamAccess(user.id, 'schedule');
        if (!canSchedule) {
          return NextResponse.json({ error: 'No schedule permission' }, { status: 403 });
        }
        
        const { data: post, error } = await supabase
          .from('social_posts')
          .update({
            ...updates,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', post_id)
          .select()
          .single();
          
        if (error) throw error;
        return NextResponse.json({ success: true, post });
      }
      
      // Approve post (AC 6)
      case 'approve': {
        const { post_id } = body;
        
        const canPublish = await checkTeamAccess(user.id, 'publish');
        if (!canPublish) {
          return NextResponse.json({ error: 'No publish permission' }, { status: 403 });
        }
        
        const { data, error } = await supabase.rpc('approve_social_post', {
          p_post_id: post_id,
          p_user_id: user.id
        });
        
        if (error) throw error;
        return NextResponse.json(data);
      }
      
      // Cancel post
      case 'cancel': {
        const { post_id } = body;
        
        const { error } = await supabase
          .from('social_posts')
          .update({
            status: 'cancelled',
            updated_by: user.id
          })
          .eq('id', post_id)
          .in('status', ['draft', 'scheduled']);
          
        if (error) throw error;
        
        // Remove from queue
        await supabase
          .from('social_publishing_queue')
          .update({ status: 'cancelled' })
          .eq('post_id', post_id);
        
        return NextResponse.json({ success: true });
      }
      
      // Connect account via OAuth callback (AC 5)
      case 'connect-account': {
        const { platform, code, state } = body;
        
        const canConnect = await checkTeamAccess(user.id, 'connect');
        if (!canConnect) {
          return NextResponse.json({ error: 'No connect permission' }, { status: 403 });
        }
        
        const config = OAUTH_CONFIGS[platform];
        if (!config && platform !== 'telegram') {
          return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
        }
        
        // For Telegram, the code is actually the bot token
        if (platform === 'telegram') {
          const botToken = code;
          // Validate bot token
          const botInfo = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const botData = await botInfo.json();
          
          if (!botData.ok) {
            return NextResponse.json({ error: 'Invalid bot token' }, { status: 400 });
          }
          
          // Get platform ID
          const { data: platformRecord } = await supabase
            .from('social_platforms')
            .select('id')
            .eq('slug', 'telegram')
            .single();
          
          // Save account
          const { data: account, error } = await supabase
            .from('social_connected_accounts')
            .insert({
              platform_id: platformRecord?.id,
              account_name: botData.result.first_name,
              account_handle: `@${botData.result.username}`,
              account_id: botData.result.id.toString(),
              access_token: botToken,
              scopes: ['send_messages'],
              connected_by: user.id
            })
            .select()
            .single();
            
          if (error) throw error;
          return NextResponse.json({ success: true, account });
        }
        
        // Exchange code for tokens
        const tokenResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env[`${platform.toUpperCase()}_CLIENT_ID`] || '',
            client_secret: process.env[`${platform.toUpperCase()}_CLIENT_SECRET`] || '',
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback`
          })
        });
        
        const tokens = await tokenResponse.json();
        
        if (tokens.error) {
          return NextResponse.json({ error: tokens.error_description || 'OAuth failed' }, { status: 400 });
        }
        
        // Get platform ID
        const { data: platformRecord } = await supabase
          .from('social_platforms')
          .select('id')
          .eq('slug', platform)
          .single();
        
        // Get account info from platform API
        let accountInfo = { name: 'Connected Account', handle: '', id: '' };
        // Platform-specific account info fetching would go here
        
        // Save connected account
        const { data: account, error } = await supabase
          .from('social_connected_accounts')
          .insert({
            platform_id: platformRecord?.id,
            account_name: accountInfo.name,
            account_handle: accountInfo.handle,
            account_id: accountInfo.id || tokens.user_id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokens.expires_in 
              ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              : null,
            scopes: config.scopes,
            connected_by: user.id
          })
          .select()
          .single();
          
        if (error) throw error;
        return NextResponse.json({ success: true, account });
      }
      
      // Disconnect account
      case 'disconnect-account': {
        const { account_id } = body;
        
        const canConnect = await checkTeamAccess(user.id, 'connect');
        if (!canConnect) {
          return NextResponse.json({ error: 'No connect permission' }, { status: 403 });
        }
        
        const { error } = await supabase
          .from('social_connected_accounts')
          .update({ status: 'revoked' })
          .eq('id', account_id);
          
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      // Sync analytics (AC 7)
      case 'sync-analytics': {
        const { post_id, views, likes, comments, shares, saves, platform_metrics } = body;
        
        await supabase.rpc('sync_post_analytics', {
          p_post_id: post_id,
          p_views: views || 0,
          p_likes: likes || 0,
          p_comments: comments || 0,
          p_shares: shares || 0,
          p_saves: saves || 0,
          p_platform_metrics: platform_metrics || {}
        });
        
        return NextResponse.json({ success: true });
      }
      
      // Add team member (AC 9)
      case 'add-team-member': {
        const { email, role, permissions } = body;
        
        const canManage = await checkTeamAccess(user.id, 'manage_team');
        if (!canManage) {
          return NextResponse.json({ error: 'No team management permission' }, { status: 403 });
        }
        
        // Find user by email
        const { data: userData } = await supabase.auth.admin.listUsers();
        const targetUser = userData.users?.find(u => u.email === email);
        
        if (!targetUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        const { data: member, error } = await supabase
          .from('social_team_members')
          .upsert({
            user_id: targetUser.id,
            role: role || 'editor',
            can_publish: permissions?.can_publish || false,
            can_schedule: permissions?.can_schedule || true,
            can_connect_accounts: permissions?.can_connect || false,
            can_manage_team: permissions?.can_manage || false,
            invited_by: user.id,
            accepted_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) throw error;
        return NextResponse.json({ success: true, member });
      }
      
      // Remove team member (AC 9)
      case 'remove-team-member': {
        const { member_id } = body;
        
        const canManage = await checkTeamAccess(user.id, 'manage_team');
        if (!canManage) {
          return NextResponse.json({ error: 'No team management permission' }, { status: 403 });
        }
        
        const { error } = await supabase
          .from('social_team_members')
          .update({ is_active: false })
          .eq('id', member_id);
          
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      // Update disclaimer (AC 10)
      case 'update-disclaimer': {
        const { disclaimer_id, disclaimer_text, is_required, placement } = body;
        
        const canManage = await checkTeamAccess(user.id, 'manage_team');
        if (!canManage) {
          return NextResponse.json({ error: 'No permission' }, { status: 403 });
        }
        
        const { data: disclaimer, error } = await supabase
          .from('social_disclaimers')
          .update({
            disclaimer_text,
            is_required,
            placement
          })
          .eq('id', disclaimer_id)
          .select()
          .single();
          
        if (error) throw error;
        return NextResponse.json({ success: true, disclaimer });
      }
      
      // Publish immediately
      case 'publish-now': {
        const { post_id } = body;
        
        const canPublish = await checkTeamAccess(user.id, 'publish');
        if (!canPublish) {
          return NextResponse.json({ error: 'No publish permission' }, { status: 403 });
        }
        
        // Get post with account
        const { data: post, error: fetchError } = await supabase
          .from('social_posts')
          .select(`
            *,
            platform:social_platforms(*),
            account:social_connected_accounts(*)
          `)
          .eq('id', post_id)
          .single();
          
        if (fetchError || !post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
        
        // Update status to publishing
        await supabase
          .from('social_posts')
          .update({ status: 'publishing' })
          .eq('id', post_id);
        
        // Simulate publishing (actual publishing would call platform APIs)
        // In production, this would be handled by a background worker
        const platformUrl = `https://${post.platform.slug}.com/post/${Date.now()}`;
        
        // Mark as published
        const { error: updateError } = await supabase
          .from('social_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            platform_post_id: `sim_${Date.now()}`,
            platform_url: platformUrl
          })
          .eq('id', post_id);
          
        if (updateError) throw updateError;
        
        // Initialize analytics
        await supabase
          .from('social_post_analytics')
          .insert({
            post_id,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0
          });
        
        return NextResponse.json({ 
          success: true,
          platform_url: platformUrl
        });
      }
      
      // Reschedule post (AC 8)
      case 'reschedule': {
        const { post_id, new_time } = body;
        
        const canSchedule = await checkTeamAccess(user.id, 'schedule');
        if (!canSchedule) {
          return NextResponse.json({ error: 'No schedule permission' }, { status: 403 });
        }
        
        const { error } = await supabase
          .from('social_posts')
          .update({
            scheduled_at: new_time,
            updated_by: user.id
          })
          .eq('id', post_id)
          .eq('status', 'scheduled');
          
        if (error) throw error;
        
        // Update queue
        await supabase
          .from('social_publishing_queue')
          .update({ next_attempt_at: new_time })
          .eq('post_id', post_id);
        
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Social API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
