// this module exports window.statsmpg
(function(){
    console.log('statsmpg.js loaded');
    var players = [],
        playersIndex = {}
    ;
    

    function init(datacsv) {
        var data = parseCSV(datacsv);
        players = data.players;
        for( var i = 0; i < players.length; ++i ) {
            var p = players[i],
                uid = playerUID(p);
            playersIndex[uid] = p;
        }
    };


    function playerUID(player) {
        return player.nom + '(' + player.team + ')';                              
    }


    function parseCSV(data){
        var players = [],
            teams = [],
            lines = data.split("\n"),
            current_team = "";
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
            var notes = parseNotes(line);
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

        function parseNotes(line) {
            var formattedNotes = line.split(','),
                notes = [];
            for( var i = 6; i < formattedNotes.length; ++i ) {
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
    }
    
    //export
    window.statsmpg = {
        init:init,
        players:playersIndex,
        playerUID: playerUID,
        playersAll: players
    };
    
})()
