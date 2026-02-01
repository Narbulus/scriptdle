import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script to merge duplicate character names across all movie script JSON files
 * Based on comprehensive duplicate analysis and user approval
 */

const SCRIPT_DIR = resolve(process.cwd(), 'public/data/scripts');

// Define all character merges to apply
const CHARACTER_MERGES = [
  // Technical notation removals
  { file: 'aladdin-1992.json', from: 'PEDDLER (VO)', to: 'PEDDLER' },
  { file: 'shrek-3.json', from: 'PRINCE CHARMING (CONT\'D)', to: 'PRINCE CHARMING' },
  { file: 'shrek-3.json', from: 'GUINEVERE (CONT\'D)', to: 'GUINEVERE' },
  { file: 'coco-2017.json', from: 'ABUELA ELENA (O.S.)', to: 'ABUELA ELENA' },
  { file: 'coco-2017.json', from: 'MIGUEL (V.O)', to: 'MIGUEL' },
  { file: 'coco-2017.json', from: 'MIGUEL (V.O.)', to: 'MIGUEL' },
  { file: 'ratatouille.json', from: 'REMY (V.O)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (V.O.)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (O.C.)', to: 'REMY' },
  { file: 'up-2009.json', from: 'NEWSREEL ANNOUNCER (O.S.)', to: 'NEWSREEL ANNOUNCER' },
  { file: 'up-2009.json', from: 'NEWSREEL ANNOUNCER (V.O.)', to: 'NEWSREEL ANNOUNCER' },
  { file: 'up-2009.json', from: 'YOUNG ELLIE (O.S.)', to: 'YOUNG ELLIE' },
  { file: 'wall-e.json', from: 'AUTOPILOT (O.S.)', to: 'AUTOPILOT' },
  { file: 'wall-e.json', from: 'CAPTAIN (INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'CAPTAIN (ON INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'CAPTAIN (OVER INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'MARY (CONT\'D)', to: 'MARY' },
  { file: 'wall-e.json', from: 'SHIP\'S COMPUTER (V.O.)', to: 'SHIP\'S COMPUTER' },

  // Emotional/location state removals
  { file: 'ratatouille.json', from: 'REMY (GIDDY)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (GUILTY)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (MOANING)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'GUSTEAU (ON T.V.)', to: 'GUSTEAU' },
  { file: 'ratatouille.json', from: 'GUSTEAU (TV)', to: 'GUSTEAU' },
  { file: 'wall-e.json', from: 'PASSENGER #2 (ON SCREEN)', to: 'PASSENGER #2' },
  { file: 'the-lion-king.json', from: 'SCAR (& HYENAS)', to: 'SCAR' },

  // Use full names/more context
  { file: 'incredibles-1.json', from: 'BOB', to: 'BOB (MR. INCREDIBLE)' },
  { file: 'the-incredibles.json', from: 'BOB', to: 'BOB (MR. INCREDIBLE)' },
  { file: 'incredibles-1.json', from: 'HELEN', to: 'HELEN (ELASTIGIRL)' },
  { file: 'the-incredibles.json', from: 'HELEN', to: 'HELEN (ELASTIGIRL)' },
  { file: 'captain-america-the-first-avenger.json', from: 'HOWARD', to: 'HOWARD STARK' },
  { file: 'captain-america-the-first-avenger.json', from: 'STARK', to: 'HOWARD STARK' },
  { file: 'captain-america-the-first-avenger.json', from: 'PEGGY', to: 'PEGGY CARTER' },
  { file: 'captain-america-the-first-avenger.json', from: 'PHILLIPS', to: 'COLONEL PHILLIPS' },
  { file: 'captain-america-the-first-avenger.json', from: 'ZOLA', to: 'DR. ZOLA' },
  { file: 'captain-america-the-first-avenger.json', from: 'SCHMIDT', to: 'RED SKULL' },
  { file: 'captain-america-the-first-avenger.json', from: 'ROGERS', to: 'STEVE' },
  { file: 'black-panther.json', from: 'JAMES', to: 'JAMES (ZURI)' },
  { file: 'captain-marvel.json', from: 'STEVE', to: 'STEVE ROGERS' },
  { file: 'captain-marvel.json', from: 'BANNER', to: 'BRUCE BANNER' },
  { file: 'captain-marvel.json', from: 'NATASHA', to: 'NATASHA ROMANOFF' },
  { file: 'captain-marvel.json', from: 'RHODEY', to: 'JAMES RHODES' },
  { file: 'captain-marvel.json', from: 'LAWSON', to: 'WENDY LAWSON' },
  { file: 'captain-marvel.json', from: 'TALOS', to: 'GENERAL TALOS' },
  { file: 'iron-man.json', from: 'HAPPY', to: 'HAPPY HOGAN' },
  { file: 'iron-man.json', from: 'STARK', to: 'TONY STARK' },
  { file: 'back-to-the-future-part-ii.json', from: 'DOC', to: 'DOC BROWN' },
  { file: 'back-to-the-future-part-ii.json', from: 'MARTY', to: 'MARTY MCFLY' },
  { file: 'back-to-the-future-part-iii.json', from: 'MARSHALL', to: 'MARSHALL STRICKLAND' },

  // Merge age variants
  { file: 'captain-marvel.json', from: 'VERS (11-YEARS OLD)', to: 'VERS' },
  { file: 'captain-marvel.json', from: 'VERS (6-YEARS-OLD)', to: 'VERS' },
  { file: 'captain-marvel.json', from: 'CAROL', to: 'VERS' },

  // Fix typos
  { file: 'ratatouille.json', from: 'LINGUNI', to: 'LINGUINI' },
  { file: 'black-panther.json', from: 'T\'CHALLLA', to: 'T\'CHALLA' },
  { file: 'black-panther.json', from: 'YOUNG KILLLMONGER', to: 'YOUNG KILLMONGER' },
  { file: 'iron-man.json', from: 'TONY STARK1', to: 'TONY STARK' },
  { file: 'captain-marvel.json', from: 'COULON', to: 'COULSON' },
  { file: 'back-to-the-future-part-ii.json', from: 'MARTY JR', to: 'MARTY JR.' },

  // ============================================================================
  // NEW MERGES - Added from comprehensive character analysis
  // ============================================================================

  // Lord of the Rings Trilogy
  { file: 'the-lord-of-the-rings-fotr.json', from: 'STRIDER', to: 'ARAGORN' },
  { file: 'the-lord-of-the-rings-fotr.json', from: 'THE RING', to: 'RING' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'GRISHNAKH', to: 'GRISHNÁK' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'SMÉGOL', to: 'SMÉAGOL' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'EOMER', to: 'ÉOMER' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'ÈOMER', to: 'ÉOMER' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'EOWYN', to: 'ÉOWYN' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'ÈOWYN', to: 'ÉOWYN' },
  { file: 'the-lord-of-the-rings-ttt.json', from: 'ÈOTHAN', to: 'ÉOTHAN' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'THEODEN', to: 'THÉODEN' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'EOWYN', to: 'ÉOWYN' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'EOMER', to: 'ÉOMER' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'OMER', to: 'ÉOMER' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'THE KING OF THE DEAD', to: 'KING OF THE DEAD' },
  { file: 'the-lord-of-the-rings-rotk.json', from: 'SMÉAGOL', to: 'GOLLUM' },

  // Harry Potter Series
  { file: 'hp-goblet-of-fire.json', from: 'VOLDERMORT', to: 'VOLDEMORT' },
  { file: 'hp-deathly-hallows-1.json', from: 'VOLDEMONT', to: 'VOLDEMORT' },

  // Star Wars Saga
  { file: 'star-wars-episode-i-the-phantom-menace.json', from: 'PADME', to: 'AMIDALA' },
  { file: 'star-wars-episode-ii-attack-of-the-clones.json', from: 'CAPTAIN', to: 'CAPTAIN TYPHO' },
  { file: 'star-wars-episode-iii-revenge-of-the-sith.json', from: 'DARTH SIDIOUS', to: 'PALPATINE' },
  { file: 'star-wars-episode-iv-a-new-hope.json', from: 'HAN', to: 'HAN SOLO' },
  { file: 'star-wars-episode-vii-the-force-awakens.json', from: 'FN-2187', to: 'FINN' },
  { file: 'star-wars-episode-vii-the-force-awakens.json', from: 'UNKAR', to: 'UNKAR PLUTT' },
  { file: 'star-wars-episode-vii-the-force-awakens.json', from: 'GENERAL STATURA', to: 'ADMIRAL STATURA' },
  { file: 'star-wars-episode-viii-the-last-jedi.json', from: 'GENERAL HUX', to: 'HUX' },
  { file: 'star-wars-episode-viii-the-last-jedi.json', from: 'KYLO', to: 'KYLO REN' },
  { file: 'star-wars-episode-ix-the-rise-of-skywalker.json', from: 'CHEWIE', to: 'CHEWBACCA' },
  { file: 'star-wars-episode-ix-the-rise-of-skywalker.json', from: 'THREEPIO', to: 'C-3PO' },
  { file: 'star-wars-episode-ix-the-rise-of-skywalker.json', from: 'BABU', to: 'BABU FRIK' },
  { file: 'star-wars-episode-ix-the-rise-of-skywalker.json', from: 'PRYDE', to: 'ALLEGIANT GENERAL PRYDE' },
  { file: 'star-wars-episode-ix-the-rise-of-skywalker.json', from: 'GENERAL PRYDE', to: 'ALLEGIANT GENERAL PRYDE' },

  // Frozen Series
  { file: 'frozen-2.json', from: 'HOMEOMAREN', to: 'HONEYMAREN' },
  { file: 'frozen-2.json', from: 'HOMEYMAREN', to: 'HONEYMAREN' },
  { file: 'frozen-2.json', from: 'LT. MATTIAS', to: 'MATTIAS' },
  { file: 'frozen-2.json', from: 'YELENA', to: 'YELANA' },
  { file: 'frozen-2.json', from: 'RUNEARD', to: 'KING RUNEARD' },
  { file: 'frozen.json', from: 'GUARD 1', to: 'GUARD' },
  { file: 'frozen.json', from: 'GUARD 2', to: 'GUARD' },
  { file: 'frozen.json', from: 'GUARD 3', to: 'GUARD' },
  { file: 'frozen.json', from: 'GUARD 4', to: 'GUARD' },
  { file: 'frozen.json', from: 'SOLDIER', to: 'GUARD' },

  // Shrek Series
  { file: 'shrek-1.json', from: 'DWARF', to: 'DWARVES' },
  { file: 'shrek-1.json', from: 'GUARD', to: 'GUARDS' },
  { file: 'shrek-1.json', from: 'MERRYMAN', to: 'MERRYMEN' },
  { file: 'shrek-1.json', from: 'THE CAPTAIN', to: 'THELONIUS' },
  { file: 'shrek-3.json', from: 'HOOK', to: 'CAPTAIN HOOK' },
  { file: 'shrek-3.json', from: 'KNIGHT (LANCELOT)', to: 'LANCELOT' },
  { file: 'shrek-3.json', from: 'WIZARD HEAD (MERLIN)', to: 'MERLIN' },
  { file: 'shrek-3.json', from: 'TEENAGER (ARTIE)', to: 'ARTIE' },
  { file: 'shrek-3.json', from: 'GINGERBREAD MAN', to: 'GINGY' },
  { file: 'shrek-3.json', from: 'QUEEN', to: 'QUEEN LILLIAN' },
  { file: 'shrek-4.json', from: 'BUTTER DANTS', to: 'BUTTER PANTS' },
  { file: 'shrek-4.json', from: 'BUTTER PANTS\'S FATHER', to: 'BUTTER PANTS\' FATHER' },
  { file: 'shrek-4.json', from: 'DONKEY\'S VOICE', to: 'DONKEY' },
  { file: 'shrek-4.json', from: 'FIONA\'S VOICE', to: 'FIONA' },
  { file: 'shrek-4.json', from: 'PUSS\'S VOICE', to: 'PUSS' },
  { file: 'shrek-4.json', from: 'SHREK\'S VOICE', to: 'SHREK' },
  { file: 'shrek-4.json', from: 'RUMPELSTILTSKIN\'S VOICE', to: 'RUMPELSTILTSKIN' },
  { file: 'shrek-4.json', from: 'TOUR GUIDE\'S VOICE', to: 'TOUR GUIDE' },
  { file: 'shrek-4.json', from: 'PALACE WITCH #1', to: 'PALACE WITCH' },

  // Cars Series
  { file: 'cars.json', from: 'LIGHTNING', to: 'LIGHTNING MCQUEEN' },
  { file: 'cars.json', from: 'MCQUEEN', to: 'LIGHTNING MCQUEEN' },
  { file: 'cars.json', from: 'TOW MATER', to: 'MATER' },
  { file: 'cars.json', from: 'TOW MATER\'', to: 'MATER' },
  { file: 'cars.json', from: 'CHICK CREW', to: 'CHICK\'S CREW' },
  { file: 'cars.json', from: 'FOLK', to: 'FOLKS' },
  { file: 'cars-3.json', from: 'LIGHTNING', to: 'LIGHTNING MCQUEEN' },
  { file: 'cars-3.json', from: 'CRUZ', to: 'CRUZ RAMIREZ' },
  { file: 'cars-3.json', from: 'SALLY', to: 'SALLY CARRERA' },
  { file: 'cars-3.json', from: 'CAL', to: 'CAL WEATHERS' },
  { file: 'cars-3.json', from: 'TEX', to: 'TEX DINOCO' },
  { file: 'cars-3.json', from: 'LOUISE NASH', to: 'LOUISE "BARNSTORMER" NASH' },

  // Toy Story & Other Pixar
  { file: 'toy-story.json', from: 'SHERIFF WOODY', to: 'WOODY' },
  { file: 'toy-story.json', from: 'SID PHILLIPS', to: 'SID' },
  { file: 'toy-story.json', from: 'ANDY\'S MOM', to: 'MRS. DAVIS' },
  { file: 'toy-story.json', from: 'ALIEN', to: 'ALIENS' },
  { file: 'finding-nemo.json', from: 'SHERMAN', to: 'DR. SHERMAN' },
  { file: 'the-incredibles.json', from: 'MR. INCREDIBLE', to: 'BOB (MR. INCREDIBLE)' },
  { file: 'the-incredibles.json', from: 'ELASTIGIRL', to: 'HELEN (ELASTIGIRL)' },
  { file: 'the-incredibles.json', from: 'BUDDY (LNCREDIBOY)', to: 'BUDDY (INCREDIBOY)' },
  { file: 'the-incredibles.json', from: 'INCREDIBOY', to: 'BUDDY (INCREDIBOY)' },
  { file: 'the-incredibles.json', from: 'RICK', to: 'RICK DICKER' },
  { file: 'ratatouille.json', from: 'T.V. NARRATOR', to: 'TV NARRATOR' },
  { file: 'ratatouille.json', from: 'GUSTEAU PHOTO', to: 'GUSTEAU' },
  { file: 'ratatouille.json', from: 'GUSTEAU SIGN', to: 'GUSTEAU' },
  { file: 'ratatouille.json', from: 'GUSTEAU SPRITE', to: 'GUSTEAU' },
  { file: 'wall-e.json', from: 'AUTOPILOT', to: 'AUTO' },
  { file: 'up-2009.json', from: 'GIRL\'S VOICE (O.S.)', to: 'YOUNG ELLIE' },
  { file: 'up-2009.json', from: 'YOUNG ELLIE', to: 'ELLIE' },
  { file: 'brave-2012.json', from: 'WITCH', to: 'THE WITCH' },
  { file: 'brave-2012.json', from: 'MAUDIE!', to: 'MAUDIE' },
  { file: 'inside-out.json', from: 'MR ANDERSEN', to: 'MR. ANDERSEN' },
  { file: 'monsters-inc.json', from: 'COMPUTERIZED VOICE', to: 'COMPUTER VOICE' },
  { file: 'a-bugs-life.json', from: 'DR FLORA', to: 'DR. FLORA' },
  { file: 'a-bugs-life.json', from: 'DR. FLORRA', to: 'DR. FLORA' },
  { file: 'a-bugs-life.json', from: 'DR SOIL', to: 'MR. SOIL' },
  { file: 'a-bugs-life.json', from: 'DR. SOIL', to: 'MR. SOIL' },
  { file: 'a-bugs-life.json', from: 'MR SOIL', to: 'MR. SOIL' },
  { file: 'a-bugs-life.json', from: 'P.T FLEA', to: 'P.T. FLEA' },
  { file: 'a-bugs-life.json', from: 'P.T.', to: 'P.T. FLEA' },
  { file: 'a-bugs-life.json', from: 'PRINCESS ATTA', to: 'ATTA' },

  // Disney Classics
  { file: 'tangled.json', from: 'FLYNN', to: 'FLYNN RIDER' },
  { file: 'tangled.json', from: 'EUGENE', to: 'FLYNN RIDER' },
  { file: 'tangled.json', from: 'GOTHEL', to: 'MOTHER GOTHEL' },
  { file: 'tangled.json', from: 'CAP', to: 'CAPTAIN OF THE GUARD' },
  { file: 'the-lion-king.json', from: 'LEBO M.', to: 'LEBO M' },
  { file: 'the-lion-king.json', from: 'FULL CHORUS', to: 'CHORUS' },
  { file: 'the-lion-king.json', from: 'MUFASA\'S SPIRIT', to: 'MUFASA' },
  { file: 'beauty-and-the-beast-1991.json', from: 'COGGSWORTH', to: 'COGSWORTH' },
  { file: 'beauty-and-the-beast-1991.json', from: 'LUMIERE', to: 'LUMIÈRE' },
  { file: 'aladdin-1992.json', from: 'OLD MAN', to: 'JAFAR' },
  { file: 'the-little-mermaid-1989.json', from: 'FLOTAM & JETSAM', to: 'FLOTSAM & JETSAM' },
  { file: 'mulan-1998.json', from: 'GRANDMA', to: 'GRANNY FA' },
  { file: 'mulan-1998.json', from: 'SHUN YU', to: 'SHAN YU' },
  { file: 'mulan-1998.json', from: 'GENERAL', to: 'GENERAL LI' },
  { file: 'hercules-1997.json', from: 'AMPHITRYION', to: 'AMPHITRYON' },
  { file: 'hercules-1997.json', from: 'HERULES', to: 'HERCULES' },
  { file: 'hercules-1997.json', from: 'AREUS', to: 'ARES' },
  { file: 'sleeping-beauty-1959.json', from: 'BRIAR ROSE', to: 'AURORA' },
  { file: 'cinderella-1950.json', from: 'GUS-GUS', to: 'GUS' },
  { file: 'cinderella-1950.json', from: 'STEPMOTHER', to: 'LADY TREMAINE' },

  // Marvel Cinematic Universe
  { file: 'iron-man.json', from: 'CAOC ANALYST #1', to: 'CAOC ANALYST' },
  { file: 'iron-man.json', from: 'CAOC ANALYST #2', to: 'CAOC ANALYST' },
  { file: 'iron-man.json', from: 'CAOC ANALYST #3', to: 'CAOC ANALYST' },
  { file: 'iron-man.json', from: 'MAN #1', to: 'MAN' },
  { file: 'iron-man.json', from: 'MAN #2', to: 'MAN' },
  { file: 'thor.json', from: 'JANE', to: 'JANE FOSTER' },
  { file: 'thor.json', from: 'DARCY', to: 'DARCY LEWIS' },
  { file: 'thor.json', from: 'ERIK', to: 'ERIK SELVIG' },
  { file: 'thor.json', from: 'ERIC SELVIG', to: 'ERIK SELVIG' },
  { file: 'thor.json', from: 'COLSON', to: 'COULSON' },
  { file: 'thor.json', from: 'VOLSATGG', to: 'VOLSTAGG' },
  { file: 'the-avengers-2012.json', from: 'FURY', to: 'NICK FURY' },
  { file: 'the-avengers-2012.json', from: 'TONY', to: 'TONY STARK' },
  { file: 'the-avengers-2012.json', from: 'IRON MAN', to: 'TONY STARK' },
  { file: 'the-avengers-2012.json', from: 'COUNCILMEN 1', to: 'COUNCILMAN' },
  { file: 'the-avengers-2012.json', from: 'COUNCILMEN 2', to: 'COUNCILMAN 2' },
  { file: 'the-avengers-2012.json', from: 'COUNCILWOMEN', to: 'COUNCILWOMAN' },
  { file: 'guardians-of-the-galaxy.json', from: 'RONAN THE ACCUSER', to: 'RONAN' },
  { file: 'guardians-of-the-galaxy.json', from: 'YONDU UDONTA', to: 'YONDU' },
  { file: 'guardians-of-the-galaxy.json', from: 'ROCKET\'', to: 'ROCKET' },
  { file: 'ant-man.json', from: 'SCOTT', to: 'SCOTT LANG' },
  { file: 'ant-man.json', from: 'CARSON', to: 'MITCHELL CARSON' },
  { file: 'doctor-strange.json', from: 'OCTOBER STRANGE', to: 'DR. STEPHEN STRANGE' },
  { file: 'doctor-strange.json', from: 'DR. STRANGE', to: 'DR. STEPHEN STRANGE' },
  { file: 'doctor-strange.json', from: 'DOCTOR STRANGE', to: 'DR. STEPHEN STRANGE' },
  { file: 'doctor-strange.json', from: 'DOCTOR STEPHEN STRANGE', to: 'DR. STEPHEN STRANGE' },
  { file: 'doctor-strange.json', from: 'CHRISTINE', to: 'CHRISTINE PALMER' },
  { file: 'doctor-strange.json', from: 'CRHSTINE PALMER', to: 'CHRISTINE PALMER' },
  { file: 'doctor-strange.json', from: 'DR. BILLY', to: 'BILLY' },
  { file: 'doctor-strange.json', from: 'KARL MORDO', to: 'MORDO' },
  { file: 'doctor-strange.json', from: 'JONATHAN', to: 'PANGBORN' },
  { file: 'black-panther.json', from: 'JAMES (ZURI)', to: 'ZURI' },
  { file: 'black-panther.json', from: 'YOUNG KILLMONGER', to: 'KILLMONGER' },
  { file: 'black-panther.json', from: 'YOUNG T\'CHAKA', to: 'T\'CHAKA' },
  { file: 'black-panther.json', from: 'SHURI\'S PROJECTION', to: 'SHURI' },
  { file: 'black-panther.json', from: 'OKOYE\'S PROJECTION', to: 'OKOYE' },
  { file: 'spider-man-homecoming.json', from: 'SUIT LADY', to: 'KAREN' },
  { file: 'spider-man-homecoming.json', from: 'VULTURE', to: 'TOOMES' },
  { file: 'captain-marvel.json', from: 'VERS', to: 'CAROL' },
  { file: 'captain-marvel.json', from: 'GENERAL TALOS', to: 'TALOS' },
  { file: 'captain-marvel.json', from: 'WENDY LAWSON', to: 'LAWSON' },
  { file: 'black-widow-film.json', from: 'GIRL', to: 'NATASHA' },

  // Back to the Future Trilogy
  { file: 'back-to-the-future.json', from: 'TV DOC', to: 'DOC' },
  { file: 'back-to-the-future.json', from: 'LYNDA', to: 'LINDA' },
  { file: 'back-to-the-future-part-ii.json', from: '1985 MARTY', to: 'MARTY MCFLY' },
  { file: 'back-to-the-future-part-ii.json', from: 'MARTY 1', to: 'MARTY MCFLY' },
  { file: 'back-to-the-future-part-iii.json', from: 'MARTY 1', to: 'MARTY' },
  { file: 'back-to-the-future-part-iii.json', from: 'MARTY II', to: 'MARTY' },
  { file: 'back-to-the-future-part-iii.json', from: 'MARSHALL STRICKLAND', to: 'STRICKLAND' },
  { file: 'back-to-the-future-part-iii.json', from: 'MAYOR', to: 'MAYOR HUBERT' },
  { file: 'back-to-the-future-part-iii.json', from: 'OLD TIMER #1 (LEVI)', to: 'LEVI' },
  { file: 'back-to-the-future-part-iii.json', from: 'OLD TIMER (LEVI)', to: 'LEVI' },
  { file: 'back-to-the-future-part-iii.json', from: 'OLD TIMER #2 (ZEKE)', to: 'ZEKE' },
  { file: 'back-to-the-future-part-iii.json', from: 'OLD TIMER #3 (JEB)', to: 'JEB' },
  { file: 'back-to-the-future-part-iii.json', from: 'OLD TIMER (JEB)', to: 'JEB' },
  { file: 'back-to-the-future-part-iii.json', from: 'WOMAN\'S VOICE', to: 'CLARA' },
  { file: 'back-to-the-future-part-iii.json', from: 'WOMAN', to: 'CLARA' },
  { file: 'back-to-the-future-part-iii.json', from: 'DEPUTY MARSHALL', to: 'DEPUTY' },

  // Other Films
  { file: 'zootopia.json', from: 'JUDY', to: 'JUDY HOPPS' },
  { file: 'zootopia.json', from: 'NICK', to: 'NICK WILDE' },
  { file: 'zootopia.json', from: 'CLAWHAUSER', to: 'BENJAMIN CLAWHAUSER' },
  { file: 'zootopia.json', from: 'OFFICER BENJAMIN CLAWHAUSER', to: 'BENJAMIN CLAWHAUSER' },
  { file: 'zootopia.json', from: 'ASSISTANT MAYOR DAWN BELLWETHER', to: 'DAWN BELLWETHER' },
  { file: 'zootopia.json', from: 'LEORE LIONHEART', to: 'LEODORE LIONHEART' },
  { file: 'big-hero-6.json', from: 'HONEY', to: 'HONEY LEMON' },
  { file: 'big-hero-6.json', from: 'TADACHI', to: 'TADASHI' },
  { file: 'wreck-it-ralph.json', from: 'ELIX', to: 'FELIX' },
  { file: 'wreck-it-ralph.json', from: 'LITWAK', to: 'MR. LITWAK' },
  { file: 'ralph-breaks-the-internet.json', from: 'VANNELLLOPE', to: 'VANELLOPE' },
  { file: 'ralph-breaks-the-internet.json', from: 'YESS', to: 'YESSS' },
  { file: 'ralph-breaks-the-internet.json', from: 'MR. SPAMLEY', to: 'J.P. SPAMLEY' },
];

// Special case: Delete invalid character from Iron Man
const CHARACTERS_TO_DELETE = [
  { file: 'iron-man.json', character: 'I\'M SORRY. I\'M SORRY.' }
];

function mergeCharacters() {
  console.log('🎬 Starting character merge process...\n');

  // Group merges by file for efficient processing
  const mergesByFile = {};
  CHARACTER_MERGES.forEach(merge => {
    if (!mergesByFile[merge.file]) {
      mergesByFile[merge.file] = [];
    }
    mergesByFile[merge.file].push({ from: merge.from, to: merge.to });
  });

  let totalChanges = 0;
  let filesModified = 0;

  // Process each file
  Object.entries(mergesByFile).forEach(([filename, merges]) => {
    const filePath = resolve(SCRIPT_DIR, filename);
    console.log(`📄 Processing: ${filename}`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      let fileChanges = 0;

      // Apply character merges
      merges.forEach(({ from, to }) => {
        let changed = false;

        // Update characters array
        if (data.characters) {
          const fromIndex = data.characters.indexOf(from);
          if (fromIndex !== -1) {
            // Remove the "from" character if "to" already exists
            if (data.characters.includes(to)) {
              data.characters.splice(fromIndex, 1);
            } else {
              // Replace "from" with "to"
              data.characters[fromIndex] = to;
            }
            changed = true;
          }
        }

        // Update all dialogue lines
        if (data.lines) {
          data.lines.forEach(line => {
            if (line.character === from) {
              line.character = to;
              changed = true;
            }
          });
        }

        if (changed) {
          console.log(`  ✓ Merged: "${from}" → "${to}"`);
          fileChanges++;
          totalChanges++;
        }
      });

      // Check for characters to delete
      const deleteEntry = CHARACTERS_TO_DELETE.find(d => d.file === filename);
      if (deleteEntry) {
        const charToDelete = deleteEntry.character;

        // Remove from characters array
        if (data.characters) {
          const index = data.characters.indexOf(charToDelete);
          if (index !== -1) {
            data.characters.splice(index, 1);
            console.log(`  ✓ Deleted character: "${charToDelete}"`);
            fileChanges++;
          }
        }

        // Remove all associated dialogue lines
        if (data.lines) {
          const originalLength = data.lines.length;
          data.lines = data.lines.filter(line => line.character !== charToDelete);
          const removed = originalLength - data.lines.length;
          if (removed > 0) {
            console.log(`  ✓ Removed ${removed} dialogue line(s) for "${charToDelete}"`);
            fileChanges++;
          }
        }
      }

      if (fileChanges > 0) {
        // Sort characters alphabetically
        if (data.characters) {
          data.characters.sort();
        }

        // Write back to file with pretty formatting
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        filesModified++;
        console.log(`  ✅ Saved with ${fileChanges} change(s)\n`);
      } else {
        console.log(`  ⏭️  No changes needed\n`);
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${filename}:`, error.message);
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Character merge complete!`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the merge
mergeCharacters();
