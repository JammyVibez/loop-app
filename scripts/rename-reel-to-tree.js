#!/usr/bin/env node
/**
 * Rename "reel" → "tree" in user-facing strings, route paths, and component names.
 * Does NOT touch API routes, database columns, or internal variable names
 * (those would need DB migrations).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Files to update (user-facing text, route references, component names)
const filesToUpdate = [
  // Pages
  'app/reels/page.tsx',
  'app/create/reel/page.tsx',
  'app/create/page.tsx',

  // Components - UI text
  'components/reels/tree-reels.tsx',
  'components/create/create-reel-form.tsx',
  'components/create/reel-editor.tsx',
  'components/create/create-hub.tsx',
  'components/create-loop-button.tsx',
  'components/home-page-client.tsx',
  'components/navigation/mobile-bottom-nav.tsx',
  'components/admin/event-management.tsx',
  'components/bookmarks/bookmarks-content.tsx',
  'components/developers/developers-content.tsx',
  'components/engagement/enhanced-share-sheet.tsx',
  'components/loops/loop-detail-client.tsx',
  'components/messages/messages-workspace.tsx',
  'components/messages/share-to-circle-modal.tsx',
  'components/messages/share-to-dm-modal.tsx',

  // Other pages
  'app/notifications/page.tsx',
  'app/onboarding/page.tsx',
  'app/earnings/page.tsx',
  'app/sitemap.ts',
];

// Replacements: user-facing text only
const replacements = [
  // Page titles and labels
  [/\"Reels\"/g, '"Trees"'],
  [/\"Reel\"/g, '"Tree"'],
  [/\'Reels\'/g, "'Trees'"],
  [/\'Reel\'/g, "'Tree'"],
  [/`Reels`/g, '`Trees`'],
  [/`Reel`/g, '`Tree`'],

  // UI labels
  [/My Reels/g, 'My Trees'],
  [/my reels/g, 'my trees'],
  [/New Reel/g, 'New Tree'],
  [/new reel/g, 'new tree'],
  [/Create Reel/g, 'Create Tree'],
  [/create reel/g, 'create tree'],
  [/Delete Reel/g, 'Delete Tree'],
  [/delete reel/g, 'delete tree'],
  [/Edit Reel/g, 'Edit Tree'],
  [/edit reel/g, 'edit tree'],
  [/Reel updated/g, 'Tree updated'],
  [/Reel deleted/g, 'Tree deleted'],
  [/Reel published/g, 'Tree published'],
  [/Duet published/g, 'Branch published'],

  // Toast messages
  [/Convert to a Reel/g, 'Convert to a Tree'],
  [/Convert to a reel/g, 'Convert to a tree'],

  // Route references
  [/\/reels\?/g, '/trees?'],
  [/\/reels/g, '/trees'],
  [/\/create\/reel/g, '/create/tree'],

  // Descriptions
  [/reels unavailable/gi, 'trees unavailable'],
  [/Reels unavailable/g, 'Trees unavailable'],
  [/failed to load reels/gi, 'failed to load trees'],
  [/Failed to load reels/g, 'Failed to load trees'],

  // Placeholder text
  [/\"My Reels\"/g, '"My Trees"'],

  // "My Trees" tab
  [/id: \"mine\".*label: \"My Reels\"/g, 'id: "mine", label: "My Trees"'],

  // Edit dialog
  [/Delete this reel/g, 'Delete this tree'],
  [/This can't be undone/g, "This can't be undone"],

  // Share
  [/Share reel/g, 'Share tree'],
  [/share reel/g, 'share tree'],

  // Comments
  [/Reel comments/g, 'Tree comments'],
  [/reel comments/g, 'tree comments'],

  // Admin
  [/reel creation/gi, 'tree creation'],

  // Notifications
  [/liked your reel/gi, 'liked your tree'],
  [/commented on your reel/gi, 'commented on your tree'],
  [/started a duet/gi, 'started a branch'],

  // Onboarding
  [/Create Reels/g, 'Create Trees'],
  [/Share Reels/g, 'Share Trees'],

  // Earnings
  [/reel earnings/gi, 'tree earnings'],
  [/Reel earnings/g, 'Tree earnings'],

  // Sitemap
  [/\/reels/g, '/trees'],
];

let totalChanges = 0;

for (const relPath of filesToUpdate) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let fileChanges = 0;

  for (const [pattern, replacement] of replacements) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      fileChanges++;
    }
  }

  if (fileChanges > 0) {
    fs.writeFileSync(fullPath, content);
    console.log(`UPDATED (${fileChanges} patterns): ${relPath}`);
    totalChanges += fileChanges;
  } else {
    console.log(`NO CHANGE: ${relPath}`);
  }
}

console.log(`\nDone! ${totalChanges} pattern matches updated across ${filesToUpdate.length} files.`);
