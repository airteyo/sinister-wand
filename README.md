# EdgeLab — quant sports betting model

A modern, fully client-side sports betting model and research terminal for **NFL, NBA, NHL, MLB and EPL**.

It prices every game from first principles, compares the model to a de-vigged sharp line, finds positive expected value across books, sizes bets with Kelly, tracks closing line value, and lets you backtest everything walk-forward.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # math + model tests
npm run build    # static site in dist/ (deploy anywhere)
```

## What's inside

| Page | What it does |
| --- | --- |
| **Overview** | Bankroll, ROI, CLV, today's top qualifying edges, model health, top-rated teams |
| **Odds board** | Every game: model fair line vs market, best price per side across 5 books, EV per price. Click any price to add it to the slip |
| **Game deep-dive** | Full margin/total distribution (with NFL key numbers), alt-line cover curve, line movement, book-by-book EV grid, model factor breakdown, injury/news adjustments, most likely exact scores |
| **Power ratings** | Kalman-filtered offense/defense ratings with 95% intervals, trend sparklines, offense-vs-defense map |
| **Model lab** | Walk-forward backtest with tunable model & strategy: equity curve, calibration plot, Brier/log-loss vs the closing market, ROI/CLV by market, CLV distribution |
| **Bet tracker** | Every tracked bet with price, edge, CLV and result; manual bets, CSV/JSON export & import |
| **Calculators** | No-vig (4 methods), EV & push-aware Kelly, correlated parlay pricer, odds converter, hedge & arbitrage |

## The model

1. **Ratings** — each team has an offense and a defense rating. After every game a **Kalman filter** updates them (linear for points sports; an **extended Kalman filter with a Poisson / negative-binomial observation** for goal and run sports). Rating variance grows between games (talent drift) and ratings regress toward the mean between seasons.
2. **Projection** — expected score for each side = league average + offense − opponent defense ± home edge, plus back-to-back rest penalties and any manual adjustment you make.
3. **Distribution** — a complete final-score distribution, not just a point estimate:
   - NFL/NBA: discretised normal margin, reshaped to **key numbers** (3, 7, 10, 14…) with the mean preserved, plus overtime resolution.
   - NHL/MLB/EPL: exact-score grid from Poisson / negative-binomial marginals with a **Dixon–Coles** low-score correction; ties resolved by OT/extra innings (or kept as draws for soccer's 3-way market).
4. **Market blend** — the sharp line is de-vigged (**Shin** by default; power, additive, multiplicative available) and blended with the model in log-odds space. Prices at off-market lines are adjusted using the model's own half-point values.
5. **Disagreement guard** — when the model and the market disagree by more than a set amount (default 8 percentage points), the "edge" is almost always information the model doesn't have (injuries, lineups). Those prices are flagged amber and excluded from recommendations and backtests.
6. **Sizing** — EV and Kelly (push-aware: `f* = (p_w·b − p_l) / (b·(p_w + p_l))`) for every price at every book, scaled by your Kelly fraction and capped per bet.

## Data

**Simulated league (default).** Each league is a synthetic universe: three seasons of latent team talent that drifts week to week and shifts between seasons, games played out from that talent, and five books (one sharp, four recreational) pricing every game from a noisy view of the truth. Openers are noisier than closing lines. The model only ever sees scores and prices, so backtests, calibration and CLV behave like the real world — including the uncomfortable parts (most "edges" aren't real; closing lines are hard to beat). Use **Sim day** (or press `N`) to play the slate, settle your bets and record CLV. Change the seed in Settings for a different universe.

**Live odds.** Add a free [The Odds API](https://the-odds-api.com) key in Settings to pull real moneyline/spread/total prices from every book. Pinnacle (when offered) or the de-vigged consensus becomes the fair reference. Without results imported, the app runs in market-only mode (line shopping vs the sharp/consensus price). Import a results CSV — `date,home,away,home_score,away_score`; football-data.co.uk files work as-is — to switch the rating model on.

Everything (settings, bets, imported data) lives in your browser's local storage. Nothing is sent anywhere except requests to The Odds API when you enable live mode.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Recharts · Zustand · Vitest

> For research and entertainment. EdgeLab never places wagers. Gamble responsibly — 1-800-GAMBLER.
