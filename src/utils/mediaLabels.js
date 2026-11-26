const MEDIA_LABELS = {
    movies: {
        singular: 'movie',
        plural: 'movies',
        selectPrompt: 'Which Film?',
        viewLink: 'VIEW MOVIES',
        correctMsg: 'Movie is correct!',
        tutorialTip: "Choose the movie the line is from. Don't be afraid to guess!",
        guessTip: "Now submit your guess. If you get the movie or character right, it's locked in!",
        moreLink: 'More Movies',
    },
    episodes: {
        singular: 'episode',
        plural: 'episodes',
        selectPrompt: 'Which Episode?',
        viewLink: 'VIEW EPISODES',
        correctMsg: 'Episode is correct!',
        tutorialTip: "Choose the episode from this season. Summaries are shown inside the picker!",
        guessTip: "Now submit your guess. If you get the episode or character right, it's locked in!",
        moreLink: 'More Packs',
    },
    seasons: {
        singular: 'season',
        plural: 'seasons',
        selectPrompt: 'Which Season?',
        viewLink: 'VIEW SEASONS',
        correctMsg: 'Season is correct!',
        tutorialTip: "Choose the season the line is from. Don't be afraid to guess!",
        guessTip: "Now submit your guess. If you get the season or character right, it's locked in!",
        moreLink: 'More Packs',
    },
    shows: {
        singular: 'show',
        plural: 'shows',
        selectPrompt: 'Which Show?',
        viewLink: 'VIEW SHOWS',
        correctMsg: 'Show is correct!',
        tutorialTip: "Choose the show the line is from. Don't be afraid to guess!",
        guessTip: "Now submit your guess. If you get the show or character right, it's locked in!",
        moreLink: 'More Packs',
    },
};

export function getMediaLabels(mediaType) {
    return MEDIA_LABELS[mediaType] || MEDIA_LABELS.movies;
}
