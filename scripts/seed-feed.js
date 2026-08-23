const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // Create judevale account (only missing one)
  const judevaleId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const existingUser = await client.query('SELECT id FROM "user" WHERE id = $1', [judevaleId]);
  if (existingUser.rows.length === 0) {
    await client.query(
      'INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, now(), now())',
      [judevaleId, 'Jude Vale', 'jude.vale@mailnest.app']
    );
  }
  const existingProf = await client.query('SELECT id FROM profiles WHERE id = $1', [judevaleId]);
  if (existingProf.rows.length === 0) {
    await client.query(
      'INSERT INTO profiles (id, username, display_name, created_at, updated_at) VALUES ($1, $2, $3, now(), now())',
      [judevaleId, 'judevale', 'Jude Vale']
    );
  }
  console.log('judevale ready');

  // Map usernames to profile UUIDs
  const usernames = [
    'avariver','noahbloom','miastone','leofrost','zoesky','kailane',
    'ivycruz','ezravale','lunapark','omarwest','ninacole','theohart',
    'ariaquinn','judevale','siashaw','rexray','noafox','elidawn','verayork','jonbell'
  ];
  const profiles = await client.query('SELECT id, username FROM profiles WHERE username = ANY($1)', [usernames]);
  const idMap = {};
  profiles.rows.forEach(function(p) { idMap[p.username] = p.id; });
  console.log('Mapped ' + Object.keys(idMap).length + ' accounts');

  // All posts
  var startTime = new Date(Date.now() - 60 * 60 * 1000);
  var posts = [
    // CHAIN 1
    { a: 'avariver', c: 'Been thinking about how most apps feel empty the first week. The ones that survive are the ones where a few people just keep showing up.', ch: 1, o: 0 },
    { a: 'noahbloom', c: 'Facts. Quiet feeds kill momentum faster than bad features.', ch: 1, o: 1, r: 0 },
    { a: 'miastone', c: "Yeah I've left so many apps after the first visit because nothing was happening. Even small activity makes a difference.", ch: 1, o: 2, r: 1 },
    { a: 'leofrost', c: "This is why I'm still here. Feels like the early days of something.", ch: 1, o: 3, r: 0 },

    // CHAIN 2
    { a: 'zoesky', c: 'Late night and the house is quiet. Perfect time to actually finish something instead of just planning it.', ch: 2, o: 0 },
    { a: 'kailane', c: "Night mode activated. What's on the agenda?", ch: 2, o: 1, r: 0 },
    { a: 'zoesky', c: 'Just trying to ship one small thing before I sleep. No more "I\'ll do it tomorrow."', ch: 2, o: 2, r: 1 },
    { a: 'ivycruz', c: "Respect. I've been stuck in planning mode for weeks.", ch: 2, o: 3, r: 0 },

    // CHAIN 3
    { a: 'ezravale', c: "Honest question \u2014 do you ever feel like you're building for people who don't exist yet?", ch: 3, o: 0 },
    { a: 'lunapark', c: 'All the time. Then one real conversation happens and it suddenly feels worth it.', ch: 3, o: 1, r: 0 },
    { a: 'omarwest', c: 'Yeah. The imaginary user is always more active than the real ones at the start.', ch: 3, o: 2, r: 0 },
    { a: 'ninacole', c: 'That one conversation thing is real. Changes the energy completely.', ch: 3, o: 3, r: 1 },

    // CHAIN 4
    { a: 'theohart', c: 'Just closed the laptop and reopened it 10 minutes later. Classic.', ch: 4, o: 0 },
    { a: 'ariaquinn', c: 'The "I\'m done for the night" lie we tell ourselves.', ch: 4, o: 1, r: 0 },
    { a: 'judevale', c: 'I\'ve accepted that "one more thing" is part of the process now.', ch: 4, o: 2, r: 0 },
    { a: 'siashaw', c: "It's never just one more thing though \uD83D\uDE02", ch: 4, o: 3, r: 1 },

    // CHAIN 5
    { a: 'rexray', c: "Anyone else notice that the best ideas come when you're not trying to force them?", ch: 5, o: 0 },
    { a: 'noafox', c: 'Yes. Shower thoughts and late night walks still undefeated.', ch: 5, o: 1, r: 0 },
    { a: 'elidawn', c: 'Forcing ideas usually just gives me mediocre versions of old ones.', ch: 5, o: 2, r: 0 },
    { a: 'verayork', c: 'I keep a notes app just for random thoughts that hit at 1am.', ch: 5, o: 3, r: 1 },

    // CHAIN 6
    { a: 'jonbell', c: 'Small progress still counts. Even if nobody sees it yet.', ch: 6, o: 0 },
    { a: 'avariver', c: "Especially when nobody sees it. That's the real test.", ch: 6, o: 1, r: 0 },
    { a: 'noahbloom', c: 'Quiet wins compound. Keep going.', ch: 6, o: 2, r: 0 },
    { a: 'miastone', c: 'Needed this reminder tonight.', ch: 6, o: 3, r: 1 },

    // CHAIN 7
    { a: 'leofrost', c: 'The difference between "I\'m building something" and "I\'m just staying busy" is getting clearer the longer I do this.', ch: 7, o: 0 },
    { a: 'zoesky', c: 'That hit. Busy feels productive until you zoom out.', ch: 7, o: 1, r: 0 },
    { a: 'kailane', c: "I've been guilty of the second one more than I want to admit.", ch: 7, o: 2, r: 0 },

    // CHAIN 8
    { a: 'ivycruz', c: 'Some days the only win is not quitting.', ch: 8, o: 0 },
    { a: 'ezravale', c: 'Those days matter more than people think.', ch: 8, o: 1, r: 0 },
    { a: 'lunapark', c: 'Showing up on the low days is the actual skill.', ch: 8, o: 2, r: 0 },

    // CHAIN 9
    { a: 'omarwest', c: "I'm curious \u2014 what made you stay on this app instead of just lurking?", ch: 9, o: 0 },
    { a: 'ninacole', c: 'The fact that a few people are actually posting real thoughts instead of just polished content.', ch: 9, o: 1, r: 0 },
    { a: 'theohart', c: 'Felt less noisy than other places. At least for now.', ch: 9, o: 2, r: 0 },
    { a: 'ariaquinn', c: 'Same. The tone here still feels human.', ch: 9, o: 3, r: 1 },

    // CHAIN 10
    { a: 'judevale', c: 'Working on something small tonight. No big announcements, just consistent effort.', ch: 10, o: 0 },
    { a: 'siashaw', c: 'The unsexy work is usually the stuff that actually moves things.', ch: 10, o: 1, r: 0 },
    { a: 'rexray', c: 'Respect the quiet grind.', ch: 10, o: 2, r: 0 },

    // CHAIN 11
    { a: 'noafox', c: "Random thought: most people don't need more motivation. They need fewer distractions.", ch: 11, o: 0 },
    { a: 'elidawn', c: 'This. Motivation is temporary. Systems and focus last longer.', ch: 11, o: 1, r: 0 },
    { a: 'verayork', c: "I've been trying to protect my attention more aggressively lately.", ch: 11, o: 2, r: 0 },
    { a: 'jonbell', c: 'Systems > hype. Every time.', ch: 11, o: 3, r: 1 },

    // CHAIN 12
    { a: 'avariver', c: "If you're reading this and you've been quiet, drop a short update. Even one sentence is enough.", ch: 12, o: 0 },
    { a: 'noahbloom', c: 'Still here. Still building. Slow but moving.', ch: 12, o: 1, r: 0 },
    { a: 'miastone', c: 'Same. Quiet week but not inactive.', ch: 12, o: 2, r: 0 },
    { a: 'leofrost', c: 'Good to see familiar names still around.', ch: 12, o: 3, r: 1 },

    // STANDALONE
    { a: 'zoesky', c: 'Some nights the only goal is to leave the place a little better than I found it.', ch: 13, o: 0 },
    { a: 'kailane', c: "Just checking in. Hope someone's having a better focus session than me right now.", ch: 14, o: 0 },
    { a: 'ivycruz', c: 'The feed feels different when people actually talk to each other instead of posting into the void.', ch: 15, o: 0 },
    { a: 'ezravale', c: 'Not every post needs to be deep. Sometimes "still here" is enough.', ch: 16, o: 0 },
    { a: 'lunapark', c: 'Appreciate the people who reply. It changes the whole energy of a post.', ch: 17, o: 0 },
    { a: 'omarwest', c: "Building in public is uncomfortable until it isn't.", ch: 18, o: 0 },
    { a: 'ninacole', c: 'One real conversation > 50 empty likes.', ch: 19, o: 0 },
    { a: 'theohart', c: "Late night thoughts hit different when you're not performing for an audience.", ch: 20, o: 0 },
    { a: 'ariaquinn', c: 'Trying to post more without overthinking every sentence.', ch: 21, o: 0 },
    { a: 'judevale', c: 'Progress is rarely loud. Most of it happens in silence.', ch: 22, o: 0 },
    { a: 'siashaw', c: "If you're waiting for the perfect moment to post, this is it.", ch: 23, o: 0 },
    { a: 'rexray', c: "Still figuring things out. That's okay.", ch: 24, o: 0 },
    { a: 'noafox', c: 'The quiet hours are usually when the honest posts show up.', ch: 25, o: 0 },
    { a: 'elidawn', c: 'Small consistent actions beat rare bursts of motivation.', ch: 26, o: 0 },
    { a: 'verayork', c: "Just wanted to leave something here so the feed doesn't feel empty.", ch: 27, o: 0 },
    { a: 'jonbell', c: "If you're still here reading this, you're already ahead of most people who just lurk.", ch: 28, o: 0 },
  ];

  // Get next available loop ID
  const maxLoop = await client.query('SELECT COALESCE(MAX(id), 185) as max_id FROM loops');
  var loopId = Number(maxLoop.rows[0].max_id) + 1;
  var timeOffset = 0;
  var createdLoops = [];
  var inserted = 0;
  var replyCount = 0;
  var rootCount = 0;
  var standaloneCount = 0;

  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];
    var authorId = idMap[post.a];
    if (!authorId) { console.log('SKIP: ' + post.a); continue; }

    var postTime = new Date(startTime.getTime() + timeOffset * 60000);
    if (post.o === 0 && post.r === undefined) {
      timeOffset += 3;
      rootCount++;
    } else if (post.r !== undefined) {
      timeOffset += 1.5;
      replyCount++;
    } else {
      timeOffset += 3;
      standaloneCount++;
    }

    var parentLoopId = null;
    var treeDepth = 0;
    if (post.r !== undefined) {
      for (var j = 0; j < createdLoops.length; j++) {
        if (createdLoops[j].ch === post.ch && createdLoops[j].o === post.r) {
          parentLoopId = createdLoops[j].id;
          treeDepth = 1;
          break;
        }
      }
    }

    try {
      await client.query(
        'INSERT INTO loops (id, author_id, content, content_type, visibility, tree_depth, parent_loop_id, created_at, updated_at) VALUES ($1, $2, $3, \'text\', \'public\', $4, $5, $6, $6)',
        [loopId, authorId, post.c, treeDepth, parentLoopId, postTime.toISOString()]
      );

      var likesCount = Math.floor(Math.random() * 8) + 1;
      var commentsCount = (post.r !== undefined) ? 0 : Math.floor(Math.random() * 5);
      var viewsCount = Math.floor(Math.random() * 30) + 8;
      var sharesCount = Math.floor(Math.random() * 3);

      await client.query(
        'INSERT INTO loop_stats (loop_id, likes_count, comments_count, branches_count, shares_count, views_count, saves_count, updated_at) VALUES ($1, $2, $3, 0, $4, $5, 0, now()) ON CONFLICT (loop_id) DO UPDATE SET likes_count = $2, comments_count = $3, shares_count = $4, views_count = $5, updated_at = now()',
        [loopId, likesCount, commentsCount, sharesCount, viewsCount]
      );

      if (parentLoopId) {
        await client.query('UPDATE loops SET comment_count = comment_count + 1 WHERE id = $1', [parentLoopId]);
      }

      createdLoops.push({ ch: post.ch, o: post.o, id: loopId, a: post.a });
      inserted++;
      loopId++;
    } catch (e) {
      console.log('FAILED: ' + post.a + ' ch=' + post.ch + ': ' + e.message.substring(0, 100));
    }
  }

  console.log('\nInserted ' + inserted + ' posts');
  console.log('  Root posts: ' + rootCount);
  console.log('  Reply posts: ' + replyCount);
  console.log('  Standalone posts: ' + standaloneCount);

  var total = await client.query('SELECT count(*) as cnt FROM loops');
  console.log('\nTotal loops in DB: ' + total.rows[0].cnt);

  await client.end();
}

main().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
