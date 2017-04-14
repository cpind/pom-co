// this module exports window.statsmpg
(function(){

    //INTERNALS
    var players = [],
        playersIndex = {},
        teams = [],
        current_team = ""
    ;

    //CONSTANTS
    var _entered_token = "<",
        _injured_token = "b"
    ;

    function init(datacsv) {
        var data = {},
            i, p, uid,
            playerscsv, teamscsv;
        if( typeof(datacsv) == 'string' ) {
            data = parseCSV(datacsv);
        } else if( typeof(datacsv) == 'object') {
            playerscsv = datacsv.playerscsv;
            teamscsv = datacsv.teamscsv;
            data = {
                players: parsePlayers(playerscsv)
//                teams: parseTeams(teamscsv)
            };
        }
        for(i = 0; i < data.players.length; ++i ) {
            players.push(data.players[i]);
        }
        for(i = 0; i < players.length; ++i ) {
            p = players[i];
            uid = p.uid;
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
            columns = header.split(','),
            i, line, player, split, c;
        for(i = 0; i < lines.length; ++i ) {
            line = lines[i];
            player = {};
            split = line.split(',');
            for(c = 0; c < 6; ++c){
                player[columns[c]] = split[c];
            }
            player.notes = parseNotes(split);
            player.uid = playerUID(player);
            // if( player.team in pl_short_name ) {
            //     player.team = pl_short_name[player.team];
            // }
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
        return {players:players, teams:teams};
    }


    function extractOpposition(line) {
        var cells = line.split(','),
            days = [],
            i, cell, team
        ;
        for(i = 0; i < cells.length; ++i) {
            cell = cells[i];
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
        for( i = 0; i < teams.length; ++i){
            team = teams[i];
            if( team.short_name === current_team ) {
                team.days = days;
            }
        }
    }


    function parseNotes(split) {
        var notes = [];
        for( var i = 6; i < split.length; ++i ) {
            var formattedNote = split[i],
                noteTokens = formattedNote.split(/[:]/),
                note = parseFloat(noteTokens[0]),
                goals = parseFloat(noteTokens[1]);
            if( isNaN(note) ){
                note = null;
            }
            notes.push({
                entered: noteTokens[0] == _entered_token,
                injured: noteTokens[0] == _injured_token,
                note:note
                //TODO add goals / owngoals property
            });
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
            ndays = 38;
        if( players.length > 0) {
            ndays = Math.min(38, players[0].notes.length - 1);
        }
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
            if( count ) agg /= count;
            if( isNaN(agg) ) {
                agg =0;
            }
            days.push(agg);
        }
        return days;
    }

    //to be removed:
    //Not used anymore
    // var pl_short_name = {
    //     "B": "Burnley",
    //     "S": "Swansea",
    //     "P": "Crystal Palace",
    //     "WBA": "West Bromwich Albion",
    //     "E": "Everton",
    //     "T": "Tottenham",
    //     "W": "West Ham",
    //     "H": "Hull City",
    //     "L": "Leicester",
    //     "M": "Manchester City",
    //     "A": "Arsenal",
    //     "C": "Chelsea"
    // };
    
    
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
