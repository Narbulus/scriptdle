#!/usr/bin/env python3
"""
Catalog of 100 Popular/Quotable Movies for Scriptdle

Movies selected based on:
- Cultural impact and quotability
- Mix of genres (comedy, drama, action, sci-fi, etc.)
- Mix of eras (1970s-2020s)
- Likely script availability
"""

# Each entry: (title, year, imsdb_slug, tmdb_id)
# imsdb_slug is the URL-friendly name for imsdb.com/scripts/{slug}.html
# tmdb_id is for character lookups

MOVIE_CATALOG = [
    # === CLASSIC QUOTABLE COMEDIES ===
    ("The Princess Bride", 1987, "Princess-Bride,-The", 2493),
    ("Ferris Bueller's Day Off", 1986, "Ferris-Buellers-Day-Off", 9377),
    ("The Breakfast Club", 1985, "Breakfast-Club,-The", 2108),
    ("Sixteen Candles", 1984, "Sixteen-Candles", 13576),
    ("Clueless", 1995, "Clueless", 9603),
    ("Mean Girls", 2004, "Mean-Girls", 10625),
    ("Groundhog Day", 1993, "Groundhog-Day", 137),
    ("Ghostbusters", 1984, "Ghostbusters", 620),
    ("Anchorman", 2004, "Anchorman-The-Legend-of-Ron-Burgundy", 8699),
    ("Zoolander", 2001, "Zoolander", 9398),
    ("Napoleon Dynamite", 2004, "Napoleon-Dynamite", 8193),
    ("Superbad", 2007, "Superbad", 8363),
    ("The Hangover", 2009, "Hangover,-The", 18785),
    ("Bridesmaids", 2011, "Bridesmaids", 52520),
    ("Step Brothers", 2008, "Step-Brothers", 12133),
    ("Talladega Nights", 2006, "Talladega-Nights-The-Ballad-of-Ricky-Bobby", 9472),
    ("Elf", 2003, "Elf", 10719),
    ("Dumb and Dumber", 1994, "Dumb-and-Dumber", 8467),
    ("Ace Ventura: Pet Detective", 1994, "Ace-Ventura-Pet-Detective", 3167),
    ("Legally Blonde", 2001, "Legally-Blonde", 8835),

    # === 80s/90s CLASSICS ===
    ("Back to the Future", 1985, "Back-to-the-Future", 105),
    ("The Goonies", 1985, "Goonies,-The", 9340),
    ("E.T. the Extra-Terrestrial", 1982, "E.T.-the-Extra-Terrestrial", 601),
    ("Beetlejuice", 1988, "Beetlejuice", 4011),
    ("Big", 1988, "Big", 2280),
    ("When Harry Met Sally", 1989, "When-Harry-Met-Sally", 639),
    ("Pretty Woman", 1990, "Pretty-Woman", 114),
    ("Home Alone", 1990, "Home-Alone", 771),
    ("Mrs. Doubtfire", 1993, "Mrs.-Doubtfire", 788),
    ("Forrest Gump", 1994, "Forrest-Gump", 13),

    # === ACTION/ADVENTURE ===
    ("Die Hard", 1988, "Die-Hard", 562),
    ("Indiana Jones and the Raiders of the Lost Ark", 1981, "Raiders-of-the-Lost-Ark", 85),
    ("Terminator 2: Judgment Day", 1991, "Terminator-2-Judgment-Day", 280),
    ("The Matrix", 1999, "Matrix,-The", 603),
    ("Kill Bill: Volume 1", 2003, "Kill-Bill-Volume-1", 24),
    ("The Dark Knight", 2008, "Dark-Knight,-The", 155),
    ("Gladiator", 2000, "Gladiator", 98),
    ("Braveheart", 1995, "Braveheart", 197),
    ("Top Gun", 1986, "Top-Gun", 744),
    ("Jurassic Park", 1993, "Jurassic-Park", 329),

    # === STAR WARS ===
    ("Star Wars: Episode IV - A New Hope", 1977, "Star-Wars-A-New-Hope", 11),
    ("Star Wars: Episode V - The Empire Strikes Back", 1980, "Star-Wars-The-Empire-Strikes-Back", 1891),
    ("Star Wars: Episode VI - Return of the Jedi", 1983, "Star-Wars-Return-of-the-Jedi", 1892),

    # === DRAMA/THRILLER ===
    ("The Godfather", 1972, "Godfather,-The", 238),
    ("The Godfather Part II", 1974, "Godfather-Part-II,-The", 240),
    ("Goodfellas", 1990, "Goodfellas", 769),
    ("Pulp Fiction", 1994, "Pulp-Fiction", 680),
    ("The Shawshank Redemption", 1994, "Shawshank-Redemption,-The", 278),
    ("Fight Club", 1999, "Fight-Club", 550),
    ("The Silence of the Lambs", 1991, "Silence-of-the-Lambs,-The", 274),
    ("Se7en", 1995, "Seven", 807),
    ("Good Will Hunting", 1997, "Good-Will-Hunting", 489),
    ("A Few Good Men", 1992, "A-Few-Good-Men", 881),
    ("The Usual Suspects", 1995, "Usual-Suspects,-The", 629),
    ("American Beauty", 1999, "American-Beauty", 14),
    ("Taxi Driver", 1976, "Taxi-Driver", 103),
    ("Scarface", 1983, "Scarface", 111),
    ("The Departed", 2006, "Departed,-The", 1422),
    ("No Country for Old Men", 2007, "No-Country-for-Old-Men", 6977),

    # === SCI-FI/FANTASY ===
    ("Blade Runner", 1982, "Blade-Runner", 78),
    ("Alien", 1979, "Alien", 348),
    ("Aliens", 1986, "Aliens", 679),
    ("The Lord of the Rings: The Fellowship of the Ring", 2001, "Lord-of-the-Rings-Fellowship-of-the-Ring,-The", 120),
    ("The Lord of the Rings: The Two Towers", 2002, "Lord-of-the-Rings-The-Two-Towers,-The", 121),
    ("The Lord of the Rings: The Return of the King", 2003, "Lord-of-the-Rings-The-Return-of-the-King,-The", 122),
    ("Harry Potter and the Sorcerer's Stone", 2001, "Harry-Potter-and-the-Sorcerers-Stone", 671),
    ("Inception", 2010, "Inception", 27205),
    ("Interstellar", 2014, "Interstellar", 157336),
    ("Avatar", 2009, "Avatar", 19995),

    # === ANIMATED (may have transcripts) ===
    ("Shrek", 2001, "Shrek", 808),
    ("Shrek 2", 2004, "Shrek-2", 809),
    ("Finding Nemo", 2003, "Finding-Nemo", 12),
    ("The Lion King", 1994, "Lion-King,-The", 8587),
    ("Toy Story", 1995, "Toy-Story", 862),
    ("The Incredibles", 2004, "Incredibles,-The", 9806),
    ("Up", 2009, "Up", 14160),
    ("Frozen", 2013, "Frozen", 109445),

    # === HORROR/THRILLER ===
    ("The Shining", 1980, "Shining,-The", 694),
    ("Psycho", 1960, "Psycho", 539),
    ("Jaws", 1975, "Jaws", 578),
    ("Get Out", 2017, "Get-Out", 419430),
    ("Scream", 1996, "Scream", 4232),
    ("A Nightmare on Elm Street", 1984, "Nightmare-on-Elm-Street,-A", 377),

    # === ROMANCE/DRAMA ===
    ("Titanic", 1997, "Titanic", 597),
    ("The Notebook", 2004, "Notebook,-The", 11036),
    ("Jerry Maguire", 1996, "Jerry-Maguire", 9428),
    ("Dirty Dancing", 1987, "Dirty-Dancing", 4979),
    ("Grease", 1978, "Grease", 621),
    ("10 Things I Hate About You", 1999, "10-Things-I-Hate-About-You", 4951),
    ("The Fault in Our Stars", 2014, "Fault-in-Our-Stars,-The", 222935),

    # === RECENT HITS ===
    ("The Wolf of Wall Street", 2013, "Wolf-of-Wall-Street,-The", 106646),
    ("Django Unchained", 2012, "Django-Unchained", 68718),
    ("The Social Network", 2010, "Social-Network,-The", 37799),
    ("La La Land", 2016, "La-La-Land", 313369),
    ("Parasite", 2019, "Parasite", 496243),
    ("Knives Out", 2019, "Knives-Out", 546554),
    ("Joker", 2019, "Joker", 475557),
    ("Once Upon a Time in Hollywood", 2019, "Once-Upon-a-Time-in-Hollywood", 466272),
    ("Black Panther", 2018, "Black-Panther", 284054),
    ("Avengers: Endgame", 2019, "Avengers-Endgame", 299534),

    # === CULT CLASSICS ===
    ("The Big Lebowski", 1998, "Big-Lebowski,-The", 115),
    ("Office Space", 1999, "Office-Space", 1542),
    ("Monty Python and the Holy Grail", 1975, "Monty-Python-and-the-Holy-Grail", 762),
    ("This Is Spinal Tap", 1984, "This-Is-Spinal-Tap", 11031),
    ("Rocky", 1976, "Rocky", 1366),
    ("Casablanca", 1942, "Casablanca", 289),
]

# Note: We have slightly more than 100 to have some margin
# for unavailable scripts
print(f"Catalog contains {len(MOVIE_CATALOG)} movies") if __name__ != "__main__" else None

def get_movie_by_slug(slug: str):
    """Find a movie by its IMSDB slug."""
    for movie in MOVIE_CATALOG:
        if movie[2] == slug:
            return movie
    return None

def get_movies_by_decade(decade: int):
    """Get movies from a specific decade (e.g., 1980 for 80s)."""
    return [m for m in MOVIE_CATALOG if decade <= m[1] < decade + 10]

def get_movies_by_year_range(start: int, end: int):
    """Get movies in a year range."""
    return [m for m in MOVIE_CATALOG if start <= m[1] <= end]


if __name__ == "__main__":
    print(f"Movie Catalog: {len(MOVIE_CATALOG)} movies")
    print("\nBy decade:")
    for decade in [1940, 1960, 1970, 1980, 1990, 2000, 2010]:
        movies = get_movies_by_decade(decade)
        if movies:
            print(f"  {decade}s: {len(movies)} movies")

    print("\nSample entries:")
    for m in MOVIE_CATALOG[:5]:
        print(f"  {m[0]} ({m[1]}) - IMSDB: {m[2]}")
