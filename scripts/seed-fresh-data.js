#!/usr/bin/env node
/**
 * Re-seed all dependent data with correct loop references.
 * Creates content-aware comments, realistic interactions, reactions, and boosts.
 */
const { Client } = require('pg');
const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

(async () => {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  try {
    // Get all loops with author info
    const loops = await c.query(`
      SELECT l.id, l.author_id, l.content, l.created_at, l.circle_id,
             p.username, p.display_name
      FROM loops l
      LEFT JOIN profiles p ON p.id = l.author_id
      WHERE l.parent_loop_id IS NULL
      ORDER BY l.created_at ASC
    `);
    console.log(`Found ${loops.rows.length} root posts`);

    // Get all profiles for commenter diversity
    const profiles = await c.query('SELECT id, username, display_name FROM profiles');
    const profileList = profiles.rows;
    console.log(`Found ${profileList.length} profiles`);

    // Content-aware comment templates keyed by content keywords
    function getCommentsForPost(post, profiles) {
      const content = (post.content || '').toLowerCase();
      const comments = [];
      const authorId = post.author_id;
      
      // Pick 1-4 commenters (not the post author)
      const available = profiles.filter(p => p.id !== authorId);
      const shuffled = available.sort(() => Math.random() - 0.5);
      const numComments = Math.floor(Math.random() * 3) + 1; // 1-3 comments
      const commenters = shuffled.slice(0, numComments);

      const commentTemplates = [];

      // Cooking/food posts
      if (content.includes('cook') || content.includes('recipe') || content.includes('soup') || content.includes('meal') || content.includes('food') || content.includes('kitchen') || content.includes('bake') || content.includes('grill') || content.includes('coffee') || content.includes('brew') || content.includes('tea') || content.includes('butter') || content.includes('spice') || content.includes('chef')) {
        commentTemplates.push(
          "This looks amazing, saving this recipe",
          "I need to try this over the weekend",
          "What temperature do you bake at?",
          "Made something similar last week, turned out great",
          "The presentation is on point",
          "Adding this to my rotation for sure",
          "Do you have a full recipe posted somewhere?",
          "This reminds me of my grandmother's version"
        );
      }
      // Tech/coding posts
      else if (content.includes('code') || content.includes('bug') || content.includes('deploy') || content.includes('api') || content.includes('build') || content.includes('ship') || content.includes('feature') || content.includes('debug') || content.includes('fix') || content.includes('app') || content.includes('dev') || content.includes('programming') || content.includes('function') || content.includes('database') || content.includes('server') || content.includes('frontend') || content.includes('backend')) {
        commentTemplates.push(
          "Just shipped something similar, the debugging was rough",
          "This is the kind of grind that separates builders from talkers",
          "What stack are you using for this?",
          "Respect the consistency, most people would've quit",
          "Been stuck on something similar, this helps",
          "Clean work, the attention to detail shows",
          "The rubber duck method works every time",
          "Deployed on a Friday once, never again"
        );
      }
      // Art/creative posts
      else if (content.includes('art') || content.includes('draw') || content.includes('paint') || content.includes('design') || content.includes('photo') || content.includes('music') || content.includes('creative') || content.includes('film') || content.includes('video') || content.includes('edit') || content.includes('sketch') || content.includes('compose') || content.includes('song') || content.includes('mix') || content.includes('studio') || content.includes('camera') || content.includes('lens')) {
        commentTemplates.push(
          "The composition here is really strong",
          "I love the color palette choices",
          "This is giving me so much inspiration",
          "What tools did you use for this?",
          "The attention to detail is incredible",
          "This belongs in a gallery honestly",
          "The mood you captured is perfect",
          "Would love to see the process behind this"
        );
      }
      // Fitness/wellness posts
      else if (content.includes('workout') || content.includes('gym') || content.includes('run') || content.includes('fitness') || content.includes('health') || content.includes('sleep') || content.includes('meditat') || content.includes('yoga') || content.includes('morning') || content.includes('routine') || content.includes('walk') || content.includes('hike')) {
        commentTemplates.push(
          "Consistency is everything, keep it up",
          "This is motivation I needed today",
          "How long have you been doing this routine?",
          "The mental clarity from morning routines is unmatched",
          "Started something similar last month, feeling great",
          "Recovery days are just as important",
          "Love seeing people prioritize their health",
          "What's your pre-workout routine?"
        );
      }
      // Business/money posts
      else if (content.includes('money') || content.includes('business') || content.includes('revenue') || content.includes('client') || content.includes('pitch') || content.includes('sale') || content.includes('invest') || content.includes('income') || content.includes('freelanc') || content.includes('startup') || content.includes('fund') || content.includes('profit')) {
        commentTemplates.push(
          "The revenue numbers are looking solid",
          "What's your customer acquisition cost?",
          "This is how you build sustainable income",
          "Been thinking about this same approach",
          "Smart pivot, the market clearly wants this",
          "Would love to hear more about the pricing strategy",
          "The compound effect of consistent effort is real",
          "Numbers don't lie, great work"
        );
      }
      // Writing/journaling posts
      else if (content.includes('write') || content.includes('journal') || content.includes('story') || content.includes('book') || content.includes('read') || content.includes('draft') || content.includes('chapter') || content.includes('novel') || content.includes('poem') || content.includes('word') || content.includes('page') || content.includes('narrative')) {
        commentTemplates.push(
          "The writing here has such a distinct voice",
          "I can feel the emotion through the words",
          "This is raw and honest, love it",
          "Keep writing, you clearly have talent",
          "This hits different at 2am",
          "The pacing is really well done",
          "I'd read an entire book written like this",
          "Sometimes the quiet posts say the most"
        );
      }
      // Nature/outdoors posts
      else if (content.includes('nature') || content.includes('garden') || content.includes('plant') || content.includes('tree') || content.includes('flower') || content.includes('outdoor') || content.includes('sun') || content.includes('moon') || content.includes('star') || content.includes('sky') || content.includes('rain') || content.includes('weather') || content.includes('season')) {
        commentTemplates.push(
          "Nothing beats being outside in weather like this",
          "The light in this is beautiful",
          "Nature always knows how to set the mood",
          "I need to spend more time outdoors",
          "This is so peaceful to look at",
          "The garden is looking great this season",
          "Sometimes you just need to unplug and go outside",
          "Mother nature showing off again"
        );
      }
      // Sports/gaming posts
      else if (content.includes('game') || content.includes('sport') || content.includes('team') || content.includes('match') || content.includes('score') || content.includes('win') || content.includes('play') || content.includes('coach') || content.includes('league') || content.includes('competition')) {
        commentTemplates.push(
          "What a performance, the team looked solid",
          "The strategy adjustment at halftime was key",
          "This is championship-level play",
          "Haven't seen moves like that in a while",
          "The defense was absolutely locked in tonight",
          "Can we talk about that last play?",
          "This squad has serious potential this season",
          "Been following since the early days, so proud"
        );
      }
      // Default/generic but still contextual
      else {
        commentTemplates.push(
          "This really resonated with me today",
          "Needed to hear this, thanks for sharing",
          "The honesty here is refreshing",
          "I feel this on a personal level",
          "This is the kind of post that makes me come back",
          "Couldn't agree more with this take",
          "Saving this for later, it's that good",
          "Real talk, more people need to see this"
        );
      }

      // Generate timestamps 2-30 minutes after the post
      const postTime = new Date(post.created_at).getTime();

      for (let i = 0; i < numComments; i++) {
        const commenter = commenters[i];
        const template = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
        const offsetMs = (Math.random() * 28 + 2) * 60 * 1000; // 2-30 minutes after post

        comments.push({
          loop_id: post.id,
          author_id: commenter.id,
          content: template,
          created_at: new Date(postTime + offsetMs).toISOString(),
        });
      }

      return comments;
    }

    // ========================================
    // SEED COMMENTS
    // ========================================
    console.log('\nSeeding comments...');
    let totalComments = 0;
    const allComments = [];

    for (const loop of loops.rows) {
      const comments = getCommentsForPost(loop, profileList);
      allComments.push(...comments);
    }

    // Insert comments in batches
    for (let i = 0; i < allComments.length; i++) {
      const cm = allComments[i];
      try {
        await c.query(
          `INSERT INTO comments (loop_id, author_id, content, created_at) VALUES ($1, $2, $3, $4)`,
          [cm.loop_id, cm.author_id, cm.content, cm.created_at]
        );
        totalComments++;
      } catch (e) {
        // Skip duplicates or constraint errors
      }
    }
    console.log(`  Inserted ${totalComments} comments`);

    // ========================================
    // SEED INTERACTIONS (likes, bookmarks, shares)
    // ========================================
    console.log('\nSeeding interactions...');
    let totalInteractions = 0;

    for (const loop of loops.rows) {
      // Random engagement: 5-30% of profiles interact
      const engagerCount = Math.floor(Math.random() * profileList.length * 0.3) + 3;
      const engagers = profileList.sort(() => Math.random() - 0.5).slice(0, engagerCount);

      for (const engager of engagers) {
        if (engager.id === loop.author_id) continue; // Don't self-interact

        // Like (80% chance)
        if (Math.random() < 0.8) {
          try {
            await c.query(
              `INSERT INTO loop_interactions (loop_id, user_id, interaction_type, created_at) VALUES ($1, $2, 'like', $3)`,
              [loop.id, engager.id, loop.created_at]
            );
            totalInteractions++;
          } catch {}
        }

        // Bookmark (15% chance)
        if (Math.random() < 0.15) {
          try {
            await c.query(
              `INSERT INTO loop_interactions (loop_id, user_id, interaction_type, created_at) VALUES ($1, $2, 'bookmark', $3)`,
              [loop.id, engager.id, loop.created_at]
            );
            totalInteractions++;
          } catch {}
        }

        // Share (5% chance)
        if (Math.random() < 0.05) {
          try {
            await c.query(
              `INSERT INTO loop_interactions (loop_id, user_id, interaction_type, created_at) VALUES ($1, $2, 'share', $3)`,
              [loop.id, engager.id, loop.created_at]
            );
            totalInteractions++;
          } catch {}
        }
      }
    }
    console.log(`  Inserted ${totalInteractions} interactions`);

    // ========================================
    // SEED REACTIONS (emoji reactions)
    // ========================================
    console.log('\nSeeding reactions...');
    let totalReactions = 0;
    const emojis = ['❤️', '🔥', '👏', '💯', '😂', '🤔', '😮', '🙌'];

    for (const loop of loops.rows) {
      const reactorCount = Math.floor(Math.random() * 8) + 1;
      const reactors = profileList.sort(() => Math.random() - 0.5).slice(0, reactorCount);

      for (const reactor of reactors) {
        if (reactor.id === loop.author_id) continue;
        try {
          await c.query(
            `INSERT INTO loop_reactions (loop_id, user_id, emoji, created_at) VALUES ($1, $2, $3, $4)`,
            [loop.id, reactor.id, emojis[Math.floor(Math.random() * emojis.length)], loop.created_at]
          );
          totalReactions++;
        } catch {}
      }
    }
    console.log(`  Inserted ${totalReactions} reactions`);

    // ========================================
    // UPDATE LOOP STATS (like_count, comment_count, etc.)
    // ========================================
    console.log('\nUpdating loop_stats...');

    // Update comment counts from actual comments
    await c.query(`
      UPDATE loop_stats SET comment_count = sub.cnt
      FROM (
        SELECT loop_id, COUNT(*) as cnt FROM comments GROUP BY loop_id
      ) sub
      WHERE loop_stats.loop_id = sub.loop_id
    `);

    // Update like counts from interactions
    await c.query(`
      UPDATE loop_stats SET like_count = sub.cnt
      FROM (
        SELECT loop_id, COUNT(*) as cnt FROM loop_interactions WHERE interaction_type = 'like' GROUP BY loop_id
      ) sub
      WHERE loop_stats.loop_id = sub.loop_id
    `);

    // Update share counts
    await c.query(`
      UPDATE loop_stats SET share_count = sub.cnt
      FROM (
        SELECT loop_id, COUNT(*) as cnt FROM loop_interactions WHERE interaction_type = 'share' GROUP BY loop_id
      ) sub
      WHERE loop_stats.loop_id = sub.loop_id
    `);

    // Set realistic view counts (3-10x likes)
    await c.query(`
      UPDATE loop_stats SET view_count = GREATEST(like_count * 3 + FLOOR(RANDOM() * 20)::int, 5)
    `);

    // Set save counts
    await c.query(`
      UPDATE loop_stats SET save_count = sub.cnt
      FROM (
        SELECT loop_id, COUNT(*) as cnt FROM loop_interactions WHERE interaction_type = 'bookmark' GROUP BY loop_id
      ) sub
      WHERE loop_stats.loop_id = sub.loop_id
    `);

    console.log('  ✅ Stats updated');

    // ========================================
    // VERIFY
    // ========================================
    console.log('\nVerification:');
    const stats = await c.query(`
      SELECT 
        (SELECT COUNT(*) FROM comments) as comments,
        (SELECT COUNT(*) FROM loop_interactions) as interactions,
        (SELECT COUNT(*) FROM loop_reactions) as reactions,
        (SELECT AVG(comment_count)::int as avg_comments FROM loop_stats),
        (SELECT AVG(like_count)::int as avg_likes FROM loop_stats)
    `);
    console.log(`  Comments: ${stats.rows[0].comments}`);
    console.log(`  Interactions: ${stats.rows[0].interactions}`);
    console.log(`  Reactions: ${stats.rows[0].reactions}`);
    console.log(`  Avg comments/post: ${stats.rows[0].avg_comments}`);
    console.log(`  Avg likes/post: ${stats.rows[0].avg_likes}`);

    // Sample a post with comments
    const sample = await c.query(`
      SELECT l.id, LEFT(l.content, 50) as content, ls.comment_count, ls.like_count
      FROM loops l JOIN loop_stats ls ON ls.loop_id = l.id
      WHERE ls.comment_count > 0
      ORDER BY ls.comment_count DESC LIMIT 3
    `);
    console.log('\nTop posts by comments:');
    for (const r of sample.rows) {
      console.log(`  id=${r.id} comments=${r.comment_count} likes=${r.like_count} "${r.content}..."`);
      const postComments = await c.query(
        `SELECT c.content, p.username FROM comments c JOIN profiles p ON p.id = c.author_id WHERE c.loop_id = $1 LIMIT 3`,
        [r.id]
      );
      for (const cm of postComments.rows) {
        console.log(`    @${cm.username}: ${cm.content}`);
      }
    }

    // Reload schema
    try { await c.query("SELECT pg_notify('pgrst', 'reload schema')"); } catch {}
    
    console.log('\n✅ All seed data re-created successfully!');
    await c.end();
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
