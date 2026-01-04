#!/usr/bin/env python3
"""
Download all available movie scripts to scripts/<movie_name>/ directories.
"""

import urllib.request
import urllib.error
import os
import time
import re

SCRIPTS_DIR = "scripts"

# All movies with their sources
# Format: (title, year, sources_list)
# sources_list: [(source_name, url, extension), ...]

MOVIES = [
    # IMSDB scripts (HTML)
    ("The Princess Bride", 1987, [("imsdb", "https://imsdb.com/scripts/Princess-Bride,-The.html", "html")]),
    ("The Breakfast Club", 1985, [("imsdb", "https://imsdb.com/scripts/Breakfast-Club,-The.html", "html")]),
    ("Dumb and Dumber", 1994, [("imsdb", "https://imsdb.com/scripts/Dumb-and-Dumber.html", "html")]),
    ("American Beauty", 1999, [("imsdb", "https://imsdb.com/scripts/American-Beauty.html", "html")]),
    ("Pulp Fiction", 1994, [("imsdb", "https://imsdb.com/scripts/Pulp-Fiction.html", "html")]),
    ("Fight Club", 1999, [("imsdb", "https://imsdb.com/scripts/Fight-Club.html", "html")]),
    ("Good Will Hunting", 1997, [("imsdb", "https://imsdb.com/scripts/Good-Will-Hunting.html", "html")]),
    ("A Few Good Men", 1992, [("imsdb", "https://imsdb.com/scripts/A-Few-Good-Men.html", "html")]),
    ("The Shining", 1980, [("imsdb", "https://imsdb.com/scripts/Shining,-The.html", "html")]),
    ("Aliens", 1986, [("imsdb", "https://imsdb.com/scripts/Aliens.html", "html")]),
    ("Inception", 2010, [("imsdb", "https://imsdb.com/scripts/Inception.html", "html")]),
    ("Blade Runner", 1982, [("imsdb", "https://imsdb.com/scripts/Blade-Runner.html", "html")]),
    ("Toy Story", 1995, [("imsdb", "https://imsdb.com/scripts/Toy-Story.html", "html")]),
    ("Jurassic Park", 1993, [("imsdb", "https://imsdb.com/scripts/Jurassic-Park.html", "html")]),
    ("Star Wars A New Hope", 1977, [("imsdb", "https://imsdb.com/scripts/Star-Wars-A-New-Hope.html", "html")]),
    ("Scream", 1996, [("imsdb", "https://imsdb.com/scripts/Scream.html", "html")]),
    ("Taxi Driver", 1976, [("imsdb", "https://imsdb.com/scripts/Taxi-Driver.html", "html")]),
    ("Scarface", 1983, [("imsdb", "https://imsdb.com/scripts/Scarface.html", "html")]),
    ("The Usual Suspects", 1995, [("imsdb", "https://imsdb.com/scripts/Usual-Suspects,-The.html", "html")]),
    ("Braveheart", 1995, [("imsdb", "https://imsdb.com/scripts/Braveheart.html", "html")]),
    ("Forrest Gump", 1994, [("imsdb", "https://imsdb.com/scripts/Forrest-Gump.html", "html")]),
    ("Die Hard", 1988, [("imsdb", "https://imsdb.com/scripts/Die-Hard.html", "html")]),
    ("10 Things I Hate About You", 1999, [("imsdb", "https://imsdb.com/scripts/10-Things-I-Hate-About-You.html", "html")]),
    ("Groundhog Day", 1993, [("imsdb", "https://imsdb.com/scripts/Groundhog-Day.html", "html")]),
    ("The Social Network", 2010, [("imsdb", "https://imsdb.com/scripts/Social-Network,-The.html", "html")]),
    ("Django Unchained", 2012, [("imsdb", "https://imsdb.com/scripts/Django-Unchained.html", "html")]),
    ("The Wolf of Wall Street", 2013, [("imsdb", "https://imsdb.com/scripts/Wolf-of-Wall-Street,-The.html", "html")]),
    ("Interstellar", 2014, [("imsdb", "https://imsdb.com/scripts/Interstellar.html", "html")]),
    ("Avatar", 2009, [("imsdb", "https://imsdb.com/scripts/Avatar.html", "html")]),
    ("Joker", 2019, [("imsdb", "https://imsdb.com/scripts/Joker.html", "html")]),
    ("No Country for Old Men", 2007, [("imsdb", "https://imsdb.com/scripts/No-Country-for-Old-Men.html", "html")]),
    ("The Departed", 2006, [("imsdb", "https://imsdb.com/scripts/Departed,-The.html", "html")]),
    ("Superbad", 2007, [("imsdb", "https://imsdb.com/scripts/Superbad.html", "html")]),
    ("The Hangover", 2009, [("imsdb", "https://imsdb.com/scripts/Hangover,-The.html", "html")]),
    ("Bridesmaids", 2011, [("imsdb", "https://imsdb.com/scripts/Bridesmaids.html", "html")]),
    ("Legally Blonde", 2001, [("imsdb", "https://imsdb.com/scripts/Legally-Blonde.html", "html")]),
    ("Get Out", 2017, [("imsdb", "https://imsdb.com/scripts/Get-Out.html", "html")]),
    ("A Nightmare on Elm Street", 1984, [("imsdb", "https://imsdb.com/scripts/Nightmare-on-Elm-Street,-A.html", "html")]),
    ("Jaws", 1975, [("imsdb", "https://imsdb.com/scripts/Jaws.html", "html")]),
    ("Jerry Maguire", 1996, [("imsdb", "https://imsdb.com/scripts/Jerry-Maguire.html", "html")]),
    ("Shrek", 2001, [("imsdb", "https://imsdb.com/scripts/Shrek.html", "html")]),
    ("Up", 2009, [("imsdb", "https://imsdb.com/scripts/Up.html", "html")]),
    ("La La Land", 2016, [("imsdb", "https://imsdb.com/scripts/La-La-Land.html", "html")]),
    ("Black Panther", 2018, [("imsdb", "https://imsdb.com/scripts/Black-Panther.html", "html")]),
    ("Avengers Endgame", 2019, [("imsdb", "https://imsdb.com/scripts/Avengers-Endgame.html", "html")]),
    ("LOTR Fellowship of the Ring", 2001, [("imsdb", "https://imsdb.com/scripts/Lord-of-the-Rings-Fellowship-of-the-Ring,-The.html", "html")]),
    ("The Fault in Our Stars", 2014, [("imsdb", "https://imsdb.com/scripts/Fault-in-Our-Stars,-The.html", "html")]),

    # Scripts with alternative sources (PDFs and other formats)
    ("Back to the Future", 1985, [
        ("dailyscript", "https://www.dailyscript.com/scripts/bttf4th.pdf", "pdf"),
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/back-to-the-future-1985.pdf", "pdf"),
    ]),
    ("The Godfather", 1972, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-godfather-1972.pdf", "pdf"),
    ]),
    ("The Godfather Part II", 1974, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-godfather-part-ii-1974.pdf", "pdf"),
    ]),
    ("Goodfellas", 1990, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/goodfellas-1990.pdf", "pdf"),
    ]),
    ("Mean Girls", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/mean-girls-2004.pdf", "pdf"),
    ]),
    ("Clueless", 1995, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/clueless-1995.pdf", "pdf"),
    ]),
    ("Ferris Buellers Day Off", 1986, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/ferris-buellers-day-off-1986.pdf", "pdf"),
    ]),
    ("The Goonies", 1985, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-goonies-1985.pdf", "pdf"),
    ]),
    ("Beetlejuice", 1988, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/beetlejuice-1988.pdf", "pdf"),
    ]),
    ("E.T.", 1982, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/e-t-the-extra-terrestrial-1982.pdf", "pdf"),
    ]),
    ("When Harry Met Sally", 1989, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/when-harry-met-sally-1989.pdf", "pdf"),
    ]),
    ("Home Alone", 1990, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/home-alone-1990.pdf", "pdf"),
    ]),
    ("Mrs Doubtfire", 1993, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/mrs-doubtfire-1993.pdf", "pdf"),
    ]),
    ("The Dark Knight", 2008, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-dark-knight-2008.pdf", "pdf"),
    ]),
    ("Terminator 2", 1991, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/terminator-2-judgment-day-1991.pdf", "pdf"),
    ]),
    ("Raiders of the Lost Ark", 1981, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/raiders-of-the-lost-ark-1981.pdf", "pdf"),
    ]),
    ("Kill Bill Vol 1", 2003, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/kill-bill-vol-1-2003.pdf", "pdf"),
    ]),
    ("The Big Lebowski", 1998, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-big-lebowski-1998.pdf", "pdf"),
    ]),
    ("Office Space", 1999, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/office-space-1999.pdf", "pdf"),
    ]),
    ("Monty Python Holy Grail", 1975, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/monty-python-and-the-holy-grail-1975.pdf", "pdf"),
    ]),
    ("Casablanca", 1942, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/casablanca-1942.pdf", "pdf"),
    ]),
    ("Silence of the Lambs", 1991, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-silence-of-the-lambs-1991.pdf", "pdf"),
    ]),
    ("Se7en", 1995, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/seven-1995.pdf", "pdf"),
    ]),
    ("Sixteen Candles", 1984, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/sixteen-candles-1984.pdf", "pdf"),
    ]),
    ("Anchorman", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/anchorman-the-legend-of-ron-burgundy-2004.pdf", "pdf"),
    ]),
    ("Zoolander", 2001, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/zoolander-2001.pdf", "pdf"),
    ]),
    ("Napoleon Dynamite", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/napoleon-dynamite-2004.pdf", "pdf"),
    ]),
    ("Step Brothers", 2008, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/step-brothers-2008.pdf", "pdf"),
    ]),
    ("Elf", 2003, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/elf-2003.pdf", "pdf"),
    ]),
    ("Ghostbusters", 1984, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/ghostbusters-1984.pdf", "pdf"),
    ]),
    ("The Matrix", 1999, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-matrix-1999.pdf", "pdf"),
    ]),
    ("Gladiator", 2000, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/gladiator-2000.pdf", "pdf"),
    ]),
    ("Rocky", 1976, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/rocky-1976.pdf", "pdf"),
    ]),
    ("The Shawshank Redemption", 1994, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-shawshank-redemption-1994.pdf", "pdf"),
    ]),
    ("Titanic", 1997, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/titanic-1997.pdf", "pdf"),
    ]),
    ("Pretty Woman", 1990, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/pretty-woman-1990.pdf", "pdf"),
    ]),
    ("Dirty Dancing", 1987, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/dirty-dancing-1987.pdf", "pdf"),
    ]),
    ("Grease", 1978, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/grease-1978.pdf", "pdf"),
    ]),
    ("The Notebook", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-notebook-2004.pdf", "pdf"),
    ]),
    ("The Lion King", 1994, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-lion-king-1994.pdf", "pdf"),
    ]),
    ("Finding Nemo", 2003, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/finding-nemo-2003.pdf", "pdf"),
    ]),
    ("The Incredibles", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-incredibles-2004.pdf", "pdf"),
    ]),
    ("Shrek 2", 2004, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/shrek-2-2004.pdf", "pdf"),
    ]),
    ("Frozen", 2013, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/frozen-2013.pdf", "pdf"),
    ]),
    ("Harry Potter Sorcerers Stone", 2001, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/harry-potter-and-the-sorcerers-stone-2001.pdf", "pdf"),
    ]),
    ("LOTR Two Towers", 2002, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-lord-of-the-rings-the-two-towers-2002.pdf", "pdf"),
    ]),
    ("LOTR Return of the King", 2003, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/the-lord-of-the-rings-the-return-of-the-king-2003.pdf", "pdf"),
    ]),
    ("Star Wars Empire Strikes Back", 1980, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/star-wars-episode-v-the-empire-strikes-back-1980.pdf", "pdf"),
    ]),
    ("Star Wars Return of the Jedi", 1983, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/star-wars-episode-vi-return-of-the-jedi-1983.pdf", "pdf"),
    ]),
    ("Psycho", 1960, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/psycho-1960.pdf", "pdf"),
    ]),
    ("Alien", 1979, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/alien-1979.pdf", "pdf"),
    ]),
    ("Top Gun", 1986, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/top-gun-1986.pdf", "pdf"),
    ]),
    ("Knives Out", 2019, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/knives-out-2019.pdf", "pdf"),
    ]),
    ("Parasite", 2019, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/parasite-2019.pdf", "pdf"),
    ]),
    ("Once Upon a Time in Hollywood", 2019, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/once-upon-a-time-in-hollywood-2019.pdf", "pdf"),
    ]),
    ("This Is Spinal Tap", 1984, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/this-is-spinal-tap-1984.pdf", "pdf"),
    ]),
    ("Ace Ventura", 1994, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/ace-ventura-pet-detective-1994.pdf", "pdf"),
    ]),
    ("Big", 1988, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/big-1988.pdf", "pdf"),
    ]),
    ("Talladega Nights", 2006, [
        ("scriptslug", "https://assets.scriptslug.com/live/pdf/scripts/talladega-nights-the-ballad-of-ricky-bobby-2006.pdf", "pdf"),
    ]),
]


def slugify(title):
    """Convert title to directory-safe name."""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    return slug


def download_file(url, filepath):
    """Download a file from URL to filepath."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read()

        with open(filepath, 'wb') as f:
            f.write(content)

        return True, len(content)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return False, f"URL Error: {e.reason}"
    except Exception as e:
        return False, str(e)


def download_all():
    """Download all scripts."""
    os.makedirs(SCRIPTS_DIR, exist_ok=True)

    results = {"success": 0, "failed": 0, "movies": []}

    for title, year, sources in MOVIES:
        slug = slugify(title)
        movie_dir = os.path.join(SCRIPTS_DIR, f"{slug}-{year}")
        os.makedirs(movie_dir, exist_ok=True)

        movie_result = {"title": title, "year": year, "downloads": []}
        any_success = False

        print(f"\n{title} ({year}):")

        for source_name, url, ext in sources:
            filename = f"{source_name}.{ext}"
            filepath = os.path.join(movie_dir, filename)

            print(f"  Downloading {source_name}...", end=" ", flush=True)

            success, result = download_file(url, filepath)

            if success:
                print(f"OK ({result:,} bytes)")
                movie_result["downloads"].append({
                    "source": source_name,
                    "file": filename,
                    "size": result,
                    "success": True
                })
                any_success = True
            else:
                print(f"FAILED: {result}")
                movie_result["downloads"].append({
                    "source": source_name,
                    "error": result,
                    "success": False
                })
                # Remove empty directory if created
                if os.path.exists(filepath):
                    os.remove(filepath)

            time.sleep(0.2)  # Be nice to servers

        if any_success:
            results["success"] += 1
        else:
            results["failed"] += 1
            # Remove empty movie directory
            if os.path.isdir(movie_dir) and not os.listdir(movie_dir):
                os.rmdir(movie_dir)

        results["movies"].append(movie_result)

    return results


def print_summary(results):
    """Print download summary."""
    print("\n" + "=" * 60)
    print("DOWNLOAD SUMMARY")
    print("=" * 60)
    print(f"Total movies: {len(results['movies'])}")
    print(f"Successful: {results['success']}")
    print(f"Failed: {results['failed']}")

    # Count by source
    source_counts = {}
    for movie in results["movies"]:
        for dl in movie["downloads"]:
            if dl["success"]:
                src = dl["source"]
                source_counts[src] = source_counts.get(src, 0) + 1

    print(f"\nBy source:")
    for src, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")


if __name__ == "__main__":
    print("Downloading all movie scripts...")
    print("=" * 60)

    results = download_all()
    print_summary(results)

    # List downloaded files
    print("\n" + "=" * 60)
    print("DOWNLOADED FILES")
    print("=" * 60)

    for root, dirs, files in os.walk(SCRIPTS_DIR):
        if files:
            rel_path = os.path.relpath(root, SCRIPTS_DIR)
            print(f"\n{rel_path}/")
            for f in files:
                size = os.path.getsize(os.path.join(root, f))
                print(f"  {f} ({size:,} bytes)")
