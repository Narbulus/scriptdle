import { computed } from "@preact/signals";

export function MoviesModal({ isOpen, onClose, packName, movies, movieTitles }) {
    if (!isOpen) return null;

    return (
        <div id="movies-modal" className="modal-overlay" style={{ display: 'flex' }}>
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">{packName}</h2>
                    <button
                        id="modal-close"
                        className="modal-close-btn"
                        onClick={onClose}
                    >
                        &times;
                    </button>
                </div>
                <div className="modal-content">
                    <div id="movies-list" style={{ display: 'block' }}>
                        {movies.map(movieId => {
                            const title = movieTitles?.[movieId] || movieId;
                            return (
                                <div key={movieId} className="movie-item">{title}</div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
