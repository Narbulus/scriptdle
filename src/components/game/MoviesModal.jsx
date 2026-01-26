import { Modal } from '../common/Modal.jsx';

export function MoviesModal({ isOpen, onClose, packName, movies, movieTitles, movieYears, moviePosters }) {
    return (
        <Modal
            id="movies-modal"
            isOpen={isOpen}
            onClose={onClose}
            title={packName}
        >
            <div id="movies-list">
                {movies.map(movieId => {
                    const title = movieTitles?.[movieId] || movieId;
                    const year = movieYears?.[movieId];
                    const poster = moviePosters?.[movieId];

                    return (
                        <div key={movieId} className="movie-item">
                            {poster ? (
                                <img
                                    src={poster}
                                    alt={title}
                                    className="movie-poster-thumb"
                                />
                            ) : (
                                <div className="movie-poster-placeholder" />
                            )}
                            <div className="movie-info">
                                <div className="movie-title">{title} {year && `(${year})`}</div>
                                <div className="movie-links">
                                    <a
                                        href={`https://www.imdb.com/find?q=${encodeURIComponent(title)}`}
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
