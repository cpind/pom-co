// this module exports window.statsmpg
(function(){

    //INTERNALS
    var players = [],
        playersIndex = {},
        teams = [],
        current_team = ""
    ;


    function init(datacsv) {
        var data = {};
        if( typeof(datacsv) == 'string' ) {
            data = parseCSV(datacsv);
        } else if( typeof(datacsv) == 'object') {
            var playerscsv = datacsv.playerscsv,
                teamscsv = datacsv.teamscsv;
            data = {
                players: parsePlayers(playerscsv)
//                teams: parseTeams(teamscsv)
            }
        }
        for( var i = 0; i < data.players.length; ++i ) {
            players.push(data.players[i]);
        }
        for( var i = 0; i < players.length; ++i ) {
            var p = players[i],
                uid = playerUID(p);
            playersIndex[uid] = p;
        }
    };


    function playerUID(player) {
        return player.nom + '(' + player.team + ')';                              
    }

    function parsePlayers(data) {
        var players = [],
            lines = data.split('\n'),
            header = lines.splice(0, 1)[0],
            columns = header.split(',');
        for( var i = 0; i < lines.length; ++i ) {
            var line = lines[i],
                player = {},
                split = line.split(',');
            for( var c = 0; c < 6; ++c){
                player[columns[c]] = split[c];
            }
            player.notes = parseNotes(split);
            if( player.team in pl_short_name ) {
                player.team = pl_short_name[player.team];
            }
            players.push(player);
        }
        return players;
    }


    function parseCSV(data){
        var players = [],
            lines = data.split("\n");
        //extract teams
        var //reg = new RegExp("-{8}\s\d+\s-\s(\D+)$([^,]+)", "m");
        reg = new RegExp("-{8}[^0-9]*([0-9]*)[^A-Z]*([A-Z]*).*\n([^,]*)", "mg");
        data.replace(reg, function(m, sheet, g2, g3){
            if( sheet == 1) return;
            teams.push({
                sheet:sheet,
                name:g3,
                short_name:g2
            });
        });
        for(var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            if( (new RegExp("-{8}")).test(line)) {
                current_team = line.match(new RegExp("[A-Z]+"))[0];
            }
            if( line.startsWith("Poste") ) {
                extractOpposition(line);
                continue;
            }
            if( ! (new RegExp("^[GDMA],")).test(line)) continue;
            var split = line.split(",");
            var notes = parseNotes(split);
            var player = {
                poste: split[0],
                nom: split[1],
                tit: split[2],
                entrees: split[3],
                buts: split[4],
                team: current_team,
                notes: notes
            };
            players.push(player);
        }
        return {players:players, teams:teams}
    }


    function extractOpposition(line) {
        var cells = line.split(','),
            days = [];            
        for(var i = 0; i < cells.length; ++i) {
            var cell = cells[i];
            if( !(new RegExp("J[0-9]{2}")).test(cell) ) continue;
            var tokens = cell.split(/[:\ \(\)]/)
                .filter(function(s){
                    return s!== "";
                });
            days.push({
                day:tokens[0],
                location: tokens[1],
                opponentTeam: tokens[2]
            });
        }
        for(var i = 0; i < teams.length; ++i){
            var team = teams[i];
            if( team.short_name === current_team ) {
                team.days = days;
            }
        }
    }


    function parseNotes(split) {
        var notes = [];
        for( var i = 6; i < split.length; ++i ) {
            var formattedNote = split[i],
                noteTokens = formattedNote.split(/[\(\)]/),
                note = parseFloat(noteTokens[0]),
                goals = parseFloat(noteTokens[1]);
            if( isNaN(note) ){
                note = 0;
            }
            if( isNaN(goals) ) {
                goals = 0;
            }
            if( noteTokens[0] == "<"){
                note = "<";
            }
            notes.push({note:note, goals:goals});
        }
        return notes;
    }
    

    function playersGet(playerIds) {
        //if '*' returns all players
        if( playerIds.indexOf('*') > -1 ) {
            return players;
        }
        res =  playerIds.map(function(uid){
            return statsmpg.players[uid];
        });
        res = res.filter(function(p){return p;});
        return res;
    }


    function meansByDay(playerIds) {
        var players = playersGet(playerIds),
            days = [],
            ndays = Math.min(38, players[0].notes.length - 1);
        for( var i = 0; i < ndays; ++i ) {
            var agg = 0,
                count = 0;
            for( var p = 0; p < players.length; ++p) {
                var player = players[p],
                    note = player.notes[i].note;
                if( note && note != "<") {
                    agg += note;
                    count += 1;
                }
            }
            if( players.length ) agg /= count;
            days.push(agg);
        }
        return days;
    }

    var pl_short_name = {
        "B": "Burnley FC",
        "S": "Swansea City AFC",
        "P": "Crystal Palace",
        "WBA": "West Bromwich Albion",
        "E": "Everton FC",
        "T": "Tottenham Hotspurs",
        "W": "West Ham United",
        "H": "Hull City",
        "L": "Leicester City",
        "M": "Manchester City",
        "A": "Arsenal FC",
        "C": "Chelsea FC"
    };
    
    
    //EXPORTS
    window.statsmpg = {
        init:init,
        players:playersIndex,
        playerUID: playerUID,
        playersAll: players,
        playersGet: playersGet,
        meansByDay: meansByDay
    };
    
})()
