import type { SportKey } from '../sports';

export interface TeamInfo { name: string; abbr: string; color: string }

const t = (name: string, abbr: string, color: string): TeamInfo => ({ name, abbr, color });

export const TEAMS: Record<SportKey, TeamInfo[]> = {
  nfl: [
    t('Arizona Cardinals', 'ARI', '#97233F'), t('Atlanta Falcons', 'ATL', '#A71930'), t('Baltimore Ravens', 'BAL', '#241773'), t('Buffalo Bills', 'BUF', '#00338D'),
    t('Carolina Panthers', 'CAR', '#0085CA'), t('Chicago Bears', 'CHI', '#C83803'), t('Cincinnati Bengals', 'CIN', '#FB4F14'), t('Cleveland Browns', 'CLE', '#FF3C00'),
    t('Dallas Cowboys', 'DAL', '#003594'), t('Denver Broncos', 'DEN', '#FB4F14'), t('Detroit Lions', 'DET', '#0076B6'), t('Green Bay Packers', 'GB', '#203731'),
    t('Houston Texans', 'HOU', '#A71930'), t('Indianapolis Colts', 'IND', '#002C5F'), t('Jacksonville Jaguars', 'JAX', '#006778'), t('Kansas City Chiefs', 'KC', '#E31837'),
    t('Las Vegas Raiders', 'LV', '#A5ACAF'), t('Los Angeles Chargers', 'LAC', '#0080C6'), t('Los Angeles Rams', 'LAR', '#003594'), t('Miami Dolphins', 'MIA', '#008E97'),
    t('Minnesota Vikings', 'MIN', '#4F2683'), t('New England Patriots', 'NE', '#C60C30'), t('New Orleans Saints', 'NO', '#D3BC8D'), t('New York Giants', 'NYG', '#0B2265'),
    t('New York Jets', 'NYJ', '#125740'), t('Philadelphia Eagles', 'PHI', '#004C54'), t('Pittsburgh Steelers', 'PIT', '#FFB612'), t('San Francisco 49ers', 'SF', '#AA0000'),
    t('Seattle Seahawks', 'SEA', '#69BE28'), t('Tampa Bay Buccaneers', 'TB', '#D50A0A'), t('Tennessee Titans', 'TEN', '#4B92DB'), t('Washington Commanders', 'WAS', '#5A1414'),
  ],
  nba: [
    t('Atlanta Hawks', 'ATL', '#E03A3E'), t('Boston Celtics', 'BOS', '#007A33'), t('Brooklyn Nets', 'BKN', '#777D84'), t('Charlotte Hornets', 'CHA', '#1D1160'),
    t('Chicago Bulls', 'CHI', '#CE1141'), t('Cleveland Cavaliers', 'CLE', '#860038'), t('Dallas Mavericks', 'DAL', '#00538C'), t('Denver Nuggets', 'DEN', '#FEC524'),
    t('Detroit Pistons', 'DET', '#C8102E'), t('Golden State Warriors', 'GSW', '#1D428A'), t('Houston Rockets', 'HOU', '#CE1141'), t('Indiana Pacers', 'IND', '#FDBB30'),
    t('Los Angeles Clippers', 'LAC', '#C8102E'), t('Los Angeles Lakers', 'LAL', '#552583'), t('Memphis Grizzlies', 'MEM', '#5D76A9'), t('Miami Heat', 'MIA', '#98002E'),
    t('Milwaukee Bucks', 'MIL', '#00471B'), t('Minnesota Timberwolves', 'MIN', '#236192'), t('New Orleans Pelicans', 'NOP', '#85714D'), t('New York Knicks', 'NYK', '#F58426'),
    t('Oklahoma City Thunder', 'OKC', '#007AC1'), t('Orlando Magic', 'ORL', '#0077C0'), t('Philadelphia 76ers', 'PHI', '#006BB6'), t('Phoenix Suns', 'PHX', '#E56020'),
    t('Portland Trail Blazers', 'POR', '#E03A3E'), t('Sacramento Kings', 'SAC', '#5A2D81'), t('San Antonio Spurs', 'SAS', '#C4CED4'), t('Toronto Raptors', 'TOR', '#CE1141'),
    t('Utah Jazz', 'UTA', '#002B5C'), t('Washington Wizards', 'WAS', '#E31837'),
  ],
  nhl: [
    t('Anaheim Ducks', 'ANA', '#F47A38'), t('Boston Bruins', 'BOS', '#FFB81C'), t('Buffalo Sabres', 'BUF', '#003087'), t('Calgary Flames', 'CGY', '#C8102E'),
    t('Carolina Hurricanes', 'CAR', '#CE1126'), t('Chicago Blackhawks', 'CHI', '#CF0A2C'), t('Colorado Avalanche', 'COL', '#6F263D'), t('Columbus Blue Jackets', 'CBJ', '#002654'),
    t('Dallas Stars', 'DAL', '#006847'), t('Detroit Red Wings', 'DET', '#CE1126'), t('Edmonton Oilers', 'EDM', '#FF4C00'), t('Florida Panthers', 'FLA', '#C8102E'),
    t('Los Angeles Kings', 'LAK', '#A2AAAD'), t('Minnesota Wild', 'MIN', '#154734'), t('Montreal Canadiens', 'MTL', '#AF1E2D'), t('Nashville Predators', 'NSH', '#FFB81C'),
    t('New Jersey Devils', 'NJD', '#CE1126'), t('New York Islanders', 'NYI', '#00539B'), t('New York Rangers', 'NYR', '#0038A8'), t('Ottawa Senators', 'OTT', '#C52032'),
    t('Philadelphia Flyers', 'PHI', '#F74902'), t('Pittsburgh Penguins', 'PIT', '#FCB514'), t('San Jose Sharks', 'SJS', '#006D75'), t('Seattle Kraken', 'SEA', '#99D9D9'),
    t('St. Louis Blues', 'STL', '#002F87'), t('Tampa Bay Lightning', 'TBL', '#002868'), t('Toronto Maple Leafs', 'TOR', '#00205B'), t('Utah Mammoth', 'UTA', '#71AFE5'),
    t('Vancouver Canucks', 'VAN', '#00205B'), t('Vegas Golden Knights', 'VGK', '#B4975A'), t('Washington Capitals', 'WSH', '#C8102E'), t('Winnipeg Jets', 'WPG', '#041E42'),
  ],
  mlb: [
    t('Arizona Diamondbacks', 'ARI', '#A71930'), t('Atlanta Braves', 'ATL', '#CE1141'), t('Baltimore Orioles', 'BAL', '#DF4601'), t('Boston Red Sox', 'BOS', '#BD3039'),
    t('Chicago Cubs', 'CHC', '#0E3386'), t('Chicago White Sox', 'CWS', '#C4CED4'), t('Cincinnati Reds', 'CIN', '#C6011F'), t('Cleveland Guardians', 'CLE', '#E31937'),
    t('Colorado Rockies', 'COL', '#33006F'), t('Detroit Tigers', 'DET', '#0C2340'), t('Houston Astros', 'HOU', '#EB6E1F'), t('Kansas City Royals', 'KC', '#004687'),
    t('Los Angeles Angels', 'LAA', '#BA0021'), t('Los Angeles Dodgers', 'LAD', '#005A9C'), t('Miami Marlins', 'MIA', '#00A3E0'), t('Milwaukee Brewers', 'MIL', '#FFC52F'),
    t('Minnesota Twins', 'MIN', '#002B5C'), t('New York Mets', 'NYM', '#FF5910'), t('New York Yankees', 'NYY', '#003087'), t('Athletics', 'ATH', '#003831'),
    t('Philadelphia Phillies', 'PHI', '#E81828'), t('Pittsburgh Pirates', 'PIT', '#FDB827'), t('San Diego Padres', 'SD', '#FFC425'), t('San Francisco Giants', 'SF', '#FD5A1E'),
    t('Seattle Mariners', 'SEA', '#005C5C'), t('St. Louis Cardinals', 'STL', '#C41E3A'), t('Tampa Bay Rays', 'TB', '#8FBCE6'), t('Texas Rangers', 'TEX', '#003278'),
    t('Toronto Blue Jays', 'TOR', '#134A8E'), t('Washington Nationals', 'WSH', '#AB0003'),
  ],
  epl: [
    t('Arsenal', 'ARS', '#EF0107'), t('Aston Villa', 'AVL', '#95BFE5'), t('Bournemouth', 'BOU', '#DA291C'), t('Brentford', 'BRE', '#E30613'),
    t('Brighton and Hove Albion', 'BHA', '#0057B8'), t('Burnley', 'BUR', '#6C1D45'), t('Chelsea', 'CHE', '#034694'), t('Crystal Palace', 'CRY', '#1B458F'),
    t('Everton', 'EVE', '#003399'), t('Fulham', 'FUL', '#CCCCCC'), t('Leeds United', 'LEE', '#FFCD00'), t('Liverpool', 'LIV', '#C8102E'),
    t('Manchester City', 'MCI', '#6CABDD'), t('Manchester United', 'MUN', '#DA291C'), t('Newcastle United', 'NEW', '#241F20'), t('Nottingham Forest', 'NFO', '#DD0000'),
    t('Sunderland', 'SUN', '#EB172B'), t('Tottenham Hotspur', 'TOT', '#132257'), t('West Ham United', 'WHU', '#7A263A'), t('Wolverhampton Wanderers', 'WOL', '#FDB913'),
  ],
};
