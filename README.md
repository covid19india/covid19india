# covid19india

View our [live patient database].  If you'd like to collaborate, join the [Telegram Group].

[live patient database]: https://docs.google.com/spreadsheets/d/1nzXUdaIWC84QipdVGUKTiCSc5xntBbpMpzLm6Si33zk
[Telegram Group]: https://t.me/covid19indiaops

# to run

`git clone https://github.com/BetaTurtle/covid19india.git`

`python -m http.server`

Open http://localhost:8000 in browser to test



# to deploy 

minify and add to docs directory

Install minify 
`npm i minify -g`

`minify script.js > docs/`

`minify index.html > docs/`
