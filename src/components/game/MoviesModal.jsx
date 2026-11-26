import { Modal } from '../common/Modal.jsx';

export function MoviesModal({ isOpen, onClose, packName, movies, movieTitles, movieYears, moviePosters, seasonTitle, episodes }) {
    const isEpisodeList = Array.isArray(episodes) && episodes.length > 0;
    const hasAnyPoster = !isEpisodeList && movies.some(movieId => Boolean(moviePosters?.[movieId]));
    const modalTitle = isEpisodeList && seasonTitle ? `${packName} — ${seasonTitle}` : packName;

    return (
        <Modal
            id="movies-modal"
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
        >
            <div id="movies-list">
                {isEpisodeList ? episodes.map(ep => (
                    <div key={ep.id} className="movie-item">
                        <div className="movie-info">
                            <div className="movie-title">
                                E{String(ep.number).padStart(2, '0')} · {ep.title}
                            </div>
                            {ep.summary && (
                                <div className="movie-summary">{ep.summary}</div>
                            )}
                        </div>
                    </div>
                )) : movies.map(movieId => {
                    const title = movieTitles?.[movieId] || movieId;
                    const year = movieYears?.[movieId];
                    const poster = moviePosters?.[movieId];

                    return (
                        <div key={movieId} className="movie-item">
                            {hasAnyPoster && (poster ? (
                                <img
                                    src={poster}
                                    alt={title}
                                    className="movie-poster-thumb"
                                />
                            ) : (
                                <div className="movie-poster-placeholder" />
                            ))}
                            <div className="movie-info">
                                <div className="movie-title">{title} {year && `(${year})`}</div>
                                <div className="movie-links">
                                    <a
                                        href={`https://www.imdb.com/find?q=${encodeURIComponent(/^Season \d+$/i.test(title) ? `${packName} ${title}` : title)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="movie-imdb-link"
                                    >
                                        IMDB
                                    </a>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
