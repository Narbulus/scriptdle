### Workflow and Integrations
- Populate google analytics ID in cloudflare
- Populate google analytics ID in cloudflare

### Features and Improvements

- Fade in animations for reddit version
- More juice and animations on actions
  - Juicy and wiggle on the question mark / covered character and a way to signal that the 
  selector boxes associated with that
  - The flower should do a little spin when it fires confetti
  - Tapping on the flower again should mean more confetti
- Text rendering is a little blurry
- Better reddit share integration
- Statistics / multiplayer features / scoped to a subreddit
- Play around with making things work without scroll view
  - Maybe the script area scrolls but the chrome and footer stays fixed
- Would a multi movie be viable?
- Player count?
- Explore pack selection -> probably not. we should just do 1 post per pack

1. Get crispy about data fetching
   - Is there any need or value to fetch data from cloudflare? 
     - I think no as long as we have a consistent daily pack generation
   - Past data? how does that work. At any rate we should generate a lot of packs and just bundle the data in everything
   - how do we generate one post per game and make this configurable
   - Posting must be automatic and daily, with a configurable time of day


2. Storage
   - Localstorage is cleared on app updates so we need to use our storage interface to support reddit's redis backend so progress is never lost
   - Some form of primitive analytics using redis?




10(??). Community set up and paperwork:
 - Banner for subreddit
 - ToS/Privacy Policy for reddit app
 - Seed subreddit with past games
 - Pinned post with rules
 - 