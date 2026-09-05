/**
 * LOOP COMMUNITY CATEGORY ENGINE
 * -----------------------------------
 * Configuration-driven. Each category is a blueprint — recommended spaces,
 * features, roles, content types, homepage modules and tools. Categories are
 * NEVER restrictions: the owner can accept, remove or customize everything
 * during creation and in settings afterwards.
 *
 * To add a new category later: add one entry here. The engine, creation
 * wizard, world page and discovery all pick it up automatically.
 */

export type SpaceType =
  | "discussion"
  | "feed"
  | "chat"
  | "media"
  | "qa"
  | "polls"
  | "events"
  | "projects"
  | "resources"
  | "knowledge"
  | "challenges"
  | "gallery"
  | "custom"

export interface CategorySpace {
  name: string
  type: SpaceType
  icon: string
  description: string
}

export interface CategoryConfig {
  id: string
  label: string
  emoji: string
  tagline: string
  /** tailwind gradient stops used for the category chip */
  gradient: string
  /** brand accent hex used when a community of this category is created */
  accent: string
  recommendedSpaces: CategorySpace[]
  recommendedFeatures: string[]
  recommendedRoles: string[]
  recommendedContentTypes: string[]
  recommendedActions: string[]
  homepageModules: string[]
  visualComponents: string[]
  categoryTools: string[]
  templateHint: string
}

export const COMMUNITY_CATEGORIES: CategoryConfig[] = [
  {
    id: "anime",
    label: "Anime & Manga",
    emoji: "🌸",
    tagline: "Fandoms, theories, rankings and fan creations",
    gradient: "from-pink-500 to-rose-500",
    accent: "#ec4899",
    recommendedSpaces: [
      { name: "General Discussion", type: "discussion", icon: "message-circle", description: "Anything goes — welcome to the world" },
      { name: "Anime Discussion", type: "discussion", icon: "tv", description: "Series talk, episodes, season reviews" },
      { name: "Manga", type: "media", icon: "book-open", description: "Chapter releases, panels and scans" },
      { name: "Theories", type: "knowledge", icon: "lightbulb", description: "Foreshadowing, lore and predictions" },
      { name: "Fan Art", type: "gallery", icon: "palette", description: "Show off your creations" },
      { name: "Memes", type: "media", icon: "laugh", description: "The best of the fandom" },
      { name: "Character Battles", type: "polls", icon: "swords", description: "Who wins? Vote now" },
      { name: "Rankings", type: "polls", icon: "trophy", description: "Tier lists and community rankings" },
      { name: "Events", type: "events", icon: "calendar", description: "Watch parties and community events" },
    ],
    recommendedFeatures: ["spoiler_tags", "character_cards", "anime_references", "community_rankings", "character_debates", "fan_showcase"],
    recommendedRoles: ["Curator", "Theory Master", "Fan Artist", "Ranking Mod"],
    recommendedContentTypes: ["discussions", "fan art", "theories", "rankings", "memes"],
    recommendedActions: ["Run a character battle", "Host a watch party", "Start a ranking"],
    homepageModules: ["trending_discussion", "character_battle", "fan_showcase", "rankings", "upcoming_event"],
    visualComponents: ["posters", "character_cards", "spoiler_support"],
    categoryTools: ["spoiler-tags", "character-cards", "rankings"],
    templateHint: "An anime world with discussion, fan art and character battles ready to go.",
  },
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    tagline: "Squads, challenges, leaderboards and game talk",
    gradient: "from-violet-500 to-indigo-500",
    accent: "#8b5cf6",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Game Discussion", type: "discussion", icon: "gamepad-2", description: "Reviews, metas and patch talk" },
      { name: "Guides", type: "knowledge", icon: "compass", description: "Walkthroughs, builds and tips" },
      { name: "Squads", type: "chat", icon: "users", description: "Find teammates and squad up" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Weekly community challenges" },
      { name: "Events", type: "events", icon: "calendar", description: "Tournaments and game nights" },
      { name: "Leaderboards", type: "polls", icon: "trophy", description: "Who's on top?" },
    ],
    recommendedFeatures: ["game_tags", "squads", "challenges", "leaderboards", "events"],
    recommendedRoles: ["Squad Lead", "Guide Writer", "Tournament Mod", "Speedrunner"],
    recommendedContentTypes: ["guides", "clip highlights", "tournaments", "reviews", "challenges"],
    recommendedActions: ["Start a challenge", "Form a squad", "Host a game night"],
    homepageModules: ["current_challenge", "leaderboard", "squad_recruitment", "upcoming_event"],
    visualComponents: ["game_cards", "leaderboards", "clip_support"],
    categoryTools: ["game-tags", "squads", "leaderboards"],
    templateHint: "A gaming world built around squads, challenges and leaderboards.",
  },
  {
    id: "tech",
    label: "Technology & Developers",
    emoji: "💻",
    tagline: "Build, learn and ship together",
    gradient: "from-cyan-500 to-blue-500",
    accent: "#06b6d4",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Help", type: "qa", icon: "life-buoy", description: "Ask questions, get answers" },
      { name: "Projects", type: "projects", icon: "folder-git-2", description: "Collaborate on builds" },
      { name: "Show & Tell", type: "gallery", icon: "sparkles", description: "Ship it and show it" },
      { name: "Resources", type: "resources", icon: "library", description: "Curated links and tools" },
      { name: "Knowledge", type: "knowledge", icon: "lightbulb", description: "Write-ups and deep dives" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Hackathon-style sprints" },
    ],
    recommendedFeatures: ["projects", "qa", "resources", "contributor_recognition"],
    recommendedRoles: ["Maintainer", "Reviewer", "Knowledge Keeper", "Mentor"],
    recommendedContentTypes: ["projects", "questions", "resources", "write-ups", "showcases"],
    recommendedActions: ["Start a project", "Answer a question", "Post a resource"],
    homepageModules: ["new_project", "open_questions", "top_resource", "contribution_feed"],
    visualComponents: ["project_cards", "code_friendly", "progress_bars"],
    categoryTools: ["projects", "qa", "resource-collections"],
    templateHint: "A builder world with projects, Q&A and knowledge to grow with.",
  },
  {
    id: "education",
    label: "Education & Study",
    emoji: "📚",
    tagline: "Study together, learn faster",
    gradient: "from-emerald-500 to-teal-500",
    accent: "#10b981",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Subjects", type: "knowledge", icon: "book-open", description: "Per-subject deep dives" },
      { name: "Questions", type: "qa", icon: "help-circle", description: "Ask and answer" },
      { name: "Study Rooms", type: "chat", icon: "clock", description: "Live study sessions" },
      { name: "Resources", type: "resources", icon: "library", description: "Notes, docs and tools" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Learning sprints" },
      { name: "Events", type: "events", icon: "calendar", description: "Lectures and sessions" },
    ],
    recommendedFeatures: ["study_sessions", "questions", "learning_challenges", "progress", "resource_collections"],
    recommendedRoles: ["Study Lead", "Tutor", "Note Keeper", "Challenge Mod"],
    recommendedContentTypes: ["study guides", "questions", "progress updates", "resources"],
    recommendedActions: ["Start a study room", "Run a learning challenge", "Share resources"],
    homepageModules: ["active_study_room", "open_question", "resource_collection", "learning_challenge"],
    visualComponents: ["progress_trackers", "subject_cards", "study_timers"],
    categoryTools: ["study-rooms", "questions", "progress"],
    templateHint: "A study world with subject spaces, Q&A and live study rooms.",
  },
  {
    id: "art",
    label: "Art & Design",
    emoji: "🎨",
    tagline: "A visual-first world for creators",
    gradient: "from-amber-500 to-orange-500",
    accent: "#f59e0b",
    recommendedSpaces: [
      { name: "Gallery", type: "gallery", icon: "image", description: "The community showcase" },
      { name: "Critique", type: "discussion", icon: "messages-square", description: "Constructive feedback" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Art prompts and sprints" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Collaborative pieces" },
      { name: "Resources", type: "resources", icon: "library", description: "Tutorials, brushes, tools" },
      { name: "Showcase", type: "media", icon: "sparkles", description: "Featured work" },
    ],
    recommendedFeatures: ["visual_feed", "art_challenges", "community_showcase", "creator_recognition"],
    recommendedRoles: ["Featured Artist", "Critique Mod", "Challenge Host"],
    recommendedContentTypes: ["artwork", "WIPs", "tutorials", "challenge entries"],
    recommendedActions: ["Host an art challenge", "Feature an artist", "Run a critique circle"],
    homepageModules: ["gallery_showcase", "art_challenge", "featured_artist", "critique_spotlight"],
    visualComponents: ["visual_gallery", "artist_cards", "lightbox"],
    categoryTools: ["gallery", "art-challenges", "showcases"],
    templateHint: "A visual world led by the gallery, challenges and creator showcases.",
  },
  {
    id: "sports",
    label: "Sports",
    emoji: "⚽",
    tagline: "Match talk, rankings and team spirit",
    gradient: "from-green-500 to-emerald-500",
    accent: "#22c55e",
    recommendedSpaces: [
      { name: "News", type: "feed", icon: "newspaper", description: "Transfers, results, headlines" },
      { name: "Discussions", type: "discussion", icon: "messages-square", description: "Hot takes and analysis" },
      { name: "Matches", type: "discussion", icon: "trophy", description: "Live match threads" },
      { name: "Rankings", type: "polls", icon: "list-ordered", description: "Power rankings and polls" },
      { name: "Stats", type: "knowledge", icon: "bar-chart-3", description: "Data and breakdowns" },
      { name: "Polls", type: "polls", icon: "vote", description: "Community votes" },
      { name: "Events", type: "events", icon: "calendar", description: "Watch parties" },
    ],
    recommendedFeatures: ["match_threads", "polls", "rankings", "stats_modules", "events"],
    recommendedRoles: ["Match Thread Host", "Stat Keeper", "Poll Runner"],
    recommendedContentTypes: ["match threads", "analysis", "polls", "highlights"],
    recommendedActions: ["Open a match thread", "Run a ranking poll", "Host a watch party"],
    homepageModules: ["live_match_thread", "community_poll", "rankings", "upcoming_event"],
    visualComponents: ["stat_cards", "rankings", "match_cards"],
    categoryTools: ["match-threads", "polls", "rankings"],
    templateHint: "A fan world with match threads, rankings and stats.",
  },
  {
    id: "movies",
    label: "Movies & TV",
    emoji: "🎬",
    tagline: "Reviews, watch parties and debates",
    gradient: "from-red-500 to-rose-500",
    accent: "#ef4444",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Reviews", type: "knowledge", icon: "star", description: "Ratings and write-ups" },
      { name: "Theories", type: "knowledge", icon: "lightbulb", description: "Fan theories" },
      { name: "Fan Art", type: "gallery", icon: "palette", description: "Fan creations" },
      { name: "Memes", type: "media", icon: "laugh", description: "Fandom memes" },
      { name: "Events", type: "events", icon: "calendar", description: "Watch parties" },
    ],
    recommendedFeatures: ["watch_parties", "spoiler_tags", "reviews", "fan_showcase"],
    recommendedRoles: ["Reviewer", "Watch Party Host", "Spoiler Police"],
    recommendedContentTypes: ["reviews", "theories", "watch parties", "rankings"],
    recommendedActions: ["Host a watch party", "Post a review", "Start a ranking"],
    homepageModules: ["trending_discussion", "watch_party", "top_review", "upcoming_event"],
    visualComponents: ["poster_cards", "spoiler_support", "rating_stars"],
    categoryTools: ["watch-parties", "spoiler-tags", "reviews"],
    templateHint: "A cinema world with reviews, watch parties and spoiler-safe discussions.",
  },
  {
    id: "music",
    label: "Music",
    emoji: "🎵",
    tagline: "Tracks, playlists and the culture",
    gradient: "from-fuchsia-500 to-purple-500",
    accent: "#d946ef",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "New Releases", type: "feed", icon: "radio", description: "Fresh drops" },
      { name: "Playlists", type: "resources", icon: "list-music", description: "Share and discover" },
      { name: "Reviews", type: "knowledge", icon: "star", description: "Album and track takes" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Remix and cover challenges" },
      { name: "Events", type: "events", icon: "calendar", description: "Listening parties" },
    ],
    recommendedFeatures: ["playlists", "listening_parties", "challenges", "reviews"],
    recommendedRoles: ["Playlist Curator", "Reviewer", "Challenge Host"],
    recommendedContentTypes: ["playlists", "reviews", "challenges", "drops"],
    recommendedActions: ["Share a playlist", "Host a listening party", "Run a challenge"],
    homepageModules: ["new_release", "playlist_spotlight", "music_challenge", "upcoming_event"],
    visualComponents: ["album_cards", "playlist_cards"],
    categoryTools: ["playlists", "listening-parties"],
    templateHint: "A music world around drops, playlists and listening parties.",
  },
  {
    id: "books",
    label: "Books",
    emoji: "📖",
    tagline: "Read together, discuss deeply",
    gradient: "from-stone-500 to-amber-700",
    accent: "#a16207",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Book Club", type: "discussion", icon: "book-open", description: "Monthly reads" },
      { name: "Reviews", type: "knowledge", icon: "star", description: "Ratings and thoughts" },
      { name: "Genres", type: "knowledge", icon: "library", description: "Genre deep dives" },
      { name: "Resources", type: "resources", icon: "library", description: "Reading lists" },
    ],
    recommendedFeatures: ["book_club", "reading_lists", "reviews"],
    recommendedRoles: ["Book Club Lead", "Reviewer", "List Keeper"],
    recommendedContentTypes: ["reviews", "book club picks", "reading lists"],
    recommendedActions: ["Start a book club pick", "Share a reading list"],
    homepageModules: ["book_club_pick", "top_review", "reading_list"],
    visualComponents: ["book_cards", "reading_progress"],
    categoryTools: ["book-club", "reading-lists"],
    templateHint: "A reader world with book clubs, reviews and reading lists.",
  },
  {
    id: "memes",
    label: "Memes & Humor",
    emoji: "😂",
    tagline: "The funniest corners of Loop",
    gradient: "from-yellow-400 to-amber-500",
    accent: "#eab308",
    recommendedSpaces: [
      { name: "Trending", type: "feed", icon: "flame", description: "What's blowing up" },
      { name: "Meme Feed", type: "media", icon: "image", description: "The daily feed" },
      { name: "Challenges", type: "challenges", icon: "trophy", description: "Weekly meme battles" },
      { name: "Meme Battles", type: "polls", icon: "swords", description: "Vote for the winner" },
      { name: "Templates", type: "resources", icon: "layout-grid", description: "Fresh formats" },
      { name: "Hall of Fame", type: "gallery", icon: "crown", description: "Legendary memes" },
    ],
    recommendedFeatures: ["meme_challenges", "community_voting", "weekly_showcase", "hall_of_fame"],
    recommendedRoles: ["Meme Lord", "Challenge Host", "Hall of Fame Keeper"],
    recommendedContentTypes: ["memes", "challenge entries", "templates"],
    recommendedActions: ["Run a meme battle", "Crown a hall of fame entry"],
    homepageModules: ["meme_battle", "trending_meme", "hall_of_fame", "challenge"],
    visualComponents: ["large_media_feed", "battle_cards"],
    categoryTools: ["meme-battles", "templates", "hall-of-fame"],
    templateHint: "A comedy world built on battles, showcases and the hall of fame.",
  },
  {
    id: "creators",
    label: "Creators",
    emoji: "📹",
    tagline: "Grow your craft with people who get it",
    gradient: "from-sky-500 to-cyan-500",
    accent: "#0ea5e9",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Growth", type: "knowledge", icon: "trending-up", description: "Algorithms, tips, wins" },
      { name: "Show & Tell", type: "gallery", icon: "sparkles", description: "Share your work" },
      { name: "Collabs", type: "chat", icon: "handshake", description: "Find collaborators" },
      { name: "Resources", type: "resources", icon: "library", description: "Tools and guides" },
      { name: "Challenges", type: "challenges", icon: "flame", description: "Create-a-thons" },
    ],
    recommendedFeatures: ["collabs", "showcase", "growth_share", "creator_recognition"],
    recommendedRoles: ["Collab Connector", "Growth Mentor", "Showcase Curator"],
    recommendedContentTypes: ["creations", "growth stories", "collab requests", "resources"],
    recommendedActions: ["Find a collab", "Share a growth win", "Run a create-a-thon"],
    homepageModules: ["collab_board", "creator_showcase", "growth_win", "challenge"],
    visualComponents: ["creator_cards", "work_showcase"],
    categoryTools: ["collabs", "showcases"],
    templateHint: "A creator world built for collabs, growth and recognition.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle & Interests",
    emoji: "✨",
    tagline: "Daily life, hobbies and everything between",
    gradient: "from-teal-400 to-cyan-500",
    accent: "#14b8a6",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Hobbies", type: "discussion", icon: "palette", description: "Share what you love" },
      { name: "Media", type: "media", icon: "image", description: "Photos and moments" },
      { name: "Events", type: "events", icon: "calendar", description: "Meetups" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Group projects" },
    ],
    recommendedFeatures: ["media_feed", "events", "projects"],
    recommendedRoles: ["Event Planner", "Hobby Host"],
    recommendedContentTypes: ["moments", "hobbies", "meetups"],
    recommendedActions: ["Plan a meetup", "Start a group project"],
    homepageModules: ["popular_post", "upcoming_event", "media_spotlight"],
    visualComponents: ["photo_grid", "event_cards"],
    categoryTools: ["events", "projects"],
    templateHint: "A lifestyle world for sharing daily life and planning meetups.",
  },
  {
    id: "local",
    label: "Local / City",
    emoji: "📍",
    tagline: "Your city, your people",
    gradient: "from-lime-500 to-green-500",
    accent: "#84cc16",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "City chat" },
      { name: "Events", type: "events", icon: "calendar", description: "What's happening in town" },
      { name: "Deals & Recs", type: "resources", icon: "map-pin", description: "Best of the city" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Community initiatives" },
      { name: "Media", type: "media", icon: "camera", description: "City moments" },
    ],
    recommendedFeatures: ["events", "recommendations", "projects"],
    recommendedRoles: ["City Guide", "Event Scout"],
    recommendedContentTypes: ["events", "recommendations", "city moments"],
    recommendedActions: ["Post an event", "Share a recommendation"],
    homepageModules: ["upcoming_event", "recommendation", "city_photo"],
    visualComponents: ["event_cards", "photo_grid"],
    categoryTools: ["events", "recommendations"],
    templateHint: "A local world for events, recommendations and city life.",
  },
  {
    id: "professional",
    label: "Professional",
    emoji: "💼",
    tagline: "Careers, networking and industry talk",
    gradient: "from-slate-500 to-slate-700",
    accent: "#64748b",
    recommendedSpaces: [
      { name: "General", type: "discussion", icon: "message-circle", description: "Community hub" },
      { name: "Industry Talk", type: "discussion", icon: "building-2", description: "News and trends" },
      { name: "Q&A", type: "qa", icon: "help-circle", description: "Ask the community" },
      { name: "Jobs & Opportunities", type: "resources", icon: "briefcase", description: "Openings and gigs" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Work together" },
      { name: "Events", type: "events", icon: "calendar", description: "Webinars and meetups" },
    ],
    recommendedFeatures: ["qa", "jobs", "networking", "events"],
    recommendedRoles: ["Industry Expert", "Mentor", "Opportunity Scout"],
    recommendedContentTypes: ["industry news", "questions", "opportunities", "insights"],
    recommendedActions: ["Post an opportunity", "Host a Q&A"],
    homepageModules: ["open_question", "opportunity", "upcoming_event", "insight"],
    visualComponents: ["opportunity_cards", "expert_cards"],
    categoryTools: ["qa", "jobs", "events"],
    templateHint: "A professional world for questions, opportunities and networking.",
  },
  {
    id: "general",
    label: "General",
    emoji: "🌐",
    tagline: "A little bit of everything",
    gradient: "from-slate-400 to-slate-600",
    accent: "#64748b",
    recommendedSpaces: [
      { name: "Home", type: "feed", icon: "home", description: "The main feed" },
      { name: "Discussions", type: "discussion", icon: "messages-square", description: "Community talk" },
      { name: "Media", type: "media", icon: "image", description: "Photos, videos, memes" },
      { name: "Events", type: "events", icon: "calendar", description: "Get togethers" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Build together" },
      { name: "Members", type: "custom", icon: "users", description: "Meet the community" },
      { name: "Chat", type: "chat", icon: "message-circle", description: "Live conversation" },
    ],
    recommendedFeatures: ["media_feed", "events", "projects", "chat"],
    recommendedRoles: ["Host", "Project Lead"],
    recommendedContentTypes: ["discussions", "media", "events", "projects"],
    recommendedActions: ["Start a discussion", "Plan an event"],
    homepageModules: ["trending_discussion", "popular_post", "upcoming_event", "new_member"],
    visualComponents: ["mixed_feed", "event_cards"],
    categoryTools: [],
    templateHint: "A flexible world you shape however you like.",
  },
  {
    id: "custom",
    label: "Custom",
    emoji: "🛠️",
    tagline: "Build your world your way",
    gradient: "from-purple-500 to-fuchsia-500",
    accent: "#a855f7",
    recommendedSpaces: [
      { name: "Home", type: "feed", icon: "home", description: "The main feed" },
      { name: "Discussions", type: "discussion", icon: "messages-square", description: "Community talk" },
      { name: "Media", type: "media", icon: "image", description: "Share media" },
      { name: "Events", type: "events", icon: "calendar", description: "Events" },
      { name: "Projects", type: "projects", icon: "folder-open", description: "Collaboration" },
    ],
    recommendedFeatures: ["media_feed", "events", "projects", "chat"],
    recommendedRoles: [],
    recommendedContentTypes: ["discussions", "media", "projects", "events"],
    recommendedActions: [],
    homepageModules: ["trending_discussion", "popular_post", "new_member"],
    visualComponents: ["mixed_feed"],
    categoryTools: [],
    templateHint: "A blank canvas — customize everything from scratch.",
  },
]

export function getCategoryConfig(id: string | null | undefined): CategoryConfig {
  return COMMUNITY_CATEGORIES.find((c) => c.id === id) || COMMUNITY_CATEGORIES[COMMUNITY_CATEGORIES.length - 2] // general fallback
}

export function categoryDefaultSpaces(id: string | null | undefined): CategorySpace[] {
  return getCategoryConfig(id).recommendedSpaces
}

export const LAYOUT_PRESETS = [
  { id: "default", label: "Default", description: "Balanced feed-first layout" },
  { id: "compact", label: "Compact", description: "Dense, information-first" },
  { id: "visual", label: "Visual", description: "Media-rich grid layout" },
  { id: "magazine", label: "Magazine", description: "Editorial hero + modules" },
  { id: "dashboard", label: "Dashboard", description: "Modules and stats front" },
] as const

export const SPACE_TYPES: { id: SpaceType; label: string; icon: string; description: string }[] = [
  { id: "discussion", label: "Discussion", icon: "messages-square", description: "Threaded conversations" },
  { id: "feed", label: "Feed", icon: "layout-list", description: "Chronological posts" },
  { id: "chat", label: "Chat", icon: "message-circle", description: "Live chat" },
  { id: "media", label: "Media", icon: "image", description: "Photos and videos" },
  { id: "qa", label: "Q&A", icon: "help-circle", description: "Questions and answers" },
  { id: "polls", label: "Polls", icon: "vote", description: "Community votes" },
  { id: "events", label: "Events", icon: "calendar", description: "Scheduled gatherings" },
  { id: "projects", label: "Projects", icon: "folder-open", description: "Collaborative builds" },
  { id: "resources", label: "Resources", icon: "library", description: "Curated links and files" },
  { id: "knowledge", label: "Knowledge", icon: "lightbulb", description: "Write-ups and guides" },
  { id: "challenges", label: "Challenges", icon: "flame", description: "Missions and contests" },
  { id: "gallery", label: "Gallery", icon: "image", description: "Visual showcase" },
  { id: "custom", label: "Custom", icon: "wand-2", description: "Whatever you need" },
]