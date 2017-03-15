$(function(){

    $.ajaxSetup({
        headers:{"X-CSRFToken": Cookies.get('csrftoken')}
    });
    
    var url = window.pomcodata,
        players = [],
        $playserSelect = $('.players-select'),
        $playersList = $('.js-players-list'),
        currentTeam = null,
        $searchTeams = $('.js-search-teams'),
        totalNumberOfDays = 38,
        dataReadyDef = new $.Deferred();

    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        success: function(datacsv) {
            var data = parseCSV(datacsv);
            players = data.players;
            dataReadyDef.resolve();
        }
    });

    $('.js-teams-menu').on('click', function(){
        $('.teams-drawer').toggleClass('is-shown');
    });

    $(window).on('click', function(event){
        //        return;
        var $target = $(event.target);
        if( $target.hasClass('js-teams-menu') ||
            $target.parents('.teams-drawer').length ||
            $target.parents('.modal').length ||
            $target.hasClass('modal')) {
            return;
        }
        $('.teams-drawer').removeClass('is-shown');
    });


    //update content of the drawer according to the search input
    $searchTeams.on('input',  function(){

        var rawValue = $searchTeams.val(),
            value = rawValue.toLowerCase(),
            $teams = $('.teams-drawer-content>.teams-drawer-teams'),
            $result = $('.teams-drawer-content').children('.teams-drawer-search-result'),
            $addTeam = $('.teams-drawer-content .js-add-team');
        
        if( !value || value === "" ) {
            //reset placeholder
            $searchTeams.val("");
            $teams.show();
            $addTeam.show();
            $result.hide();
            return;
        }
        
        //generate search result
        $result.empty();
        $content = $teams.clone();
        $content.show();
        //removes section headers
        $content.find('.sidebar-section-header').remove();
        //keep only first ul
        $content.find('ul:not(:first)').remove();
        //clear ul items
        $ul = $content.find('.sidebar-teams-list');
        $ul.empty();
        //filter result
        $li = $teams.find('li.compact-team-tile').clone();
        var searchValues = prepareSearchValue(value);
        $li.filter(function(index, el){
            var raw_name = $(el).find('.compact-team-tile-link-text-name').text(),
                name = raw_name.toLowerCase(),
                match = false;
            for( var i = 0; i < searchValues.length; ++i ) {
                if( !(name.indexOf(searchValues[i]) > -1) ) {
                    return false;
                }
            }
            return true;
        }).appendTo($ul);
        $content.appendTo($result);

        var $addTeamWithName = $addTeam.clone();
        $addTeamWithName.show();
        $addTeamWithName.find('a').text("Create team name \""+ rawValue +"\"");
        $addTeamWithName.attr('data-name', rawValue);
        $addTeamWithName.appendTo($result);
        $addTeamWithName.removeClass('js-add-team');
        $addTeamWithName.addClass('js-add-team-with-name');
        $result.show();
        $teams.hide();
        $addTeam.hide();
    });

    function prepareSearchValue(value) {
        var vals = value.split(' '),
            res = [];
        for( var i = 0; i < vals.length; ++i ) {
            var val = vals[i];
            if( vals[i] === ' ' ) continue;
            res.push(val);
        }
        return res;
    }

    $('#createTeamModal').on('show.bs.modal', function(event){
        var button = $(event.relatedTarget);
        var name = button.data('name');
        if( !name || name === "") return;
        var modal = $(this);
        modal.find('#inputTeamName').val(name);
        
    })
    
    updateListMembers();
    adjustDrawerHeight();

    function updateListMembers(data){
        var $list = $('.js-list-members');
        if( $list.length < 1 ) {
            return;
        }
        $list.empty();
        if( !data ) {
            data = $list[0].dataset.members;
        }
        members = JSON.parse(data);
        for(var i = 0; i < members.length; ++i){
            var member = members[i];
            $list.append(
                '<li>'
                    + member
                    + '</li>');
        }
    }

    $(window).resize(adjustDrawerHeight);

    function adjustDrawerHeight(){
        var topbarHeight =
            50 // topbar height
            + 15 // drawer margin top
            + 16 // content margin top
            + 10, // drawer margin bottom
            maxHeight = $(window).height() - topbarHeight;
        $('.teams-drawer-content').css('max-height', maxHeight);        
    }
    
    $('.js-validate-players').on('click', function(event){
        var $checked = $playersList.find('input:checked'),
            target = event.target,
            $target = $(target),
            url = target.dataset.url,
            members = $.map($checked, function(item){
                return $(item).val();
            });
        
        //update members on db
        $.ajax({
            type: "POST",
            url: url,
            dataType: "json",
            data:{members:JSON.stringify(members)}
        }).done(function(data){
            //clear the list
            updateListMembers(data.members);
            $playersList.empty();
            $playserSelect.removeClass('show');
            currentTeam = data;
        });

    });
    
    $('.js-add-player').on('click', function(event){

        var $target = event.target,
            jsonMembers = $target.dataset.members,
            teamIs = event.target.dataset.teamId;

        if( currentTeam ){
            jsonMembers = currentTeam.members;
        }
        
        var members = JSON.parse(jsonMembers);
        
        $div = $playersList;
        //clear the list, just-in-case
        $div.empty();
        $list = $('<ul></ul>');
        $div.append($list);

        for( var i = 0; i < players.length; ++i){

            var player = players[i],
                value = getPlayerUID(player),//player.nom + '('+player.team+')',
                checked = members.indexOf(value) > -1 ? 'checked=true' : '';
            
            $list.append(
                '<li>'
                    + '<input type="checkbox"'
                    + 'value="'+ value +'" '
                    + checked
                    + '"/>'
                    + '<span class="name">' + player.nom + '</span>'
                    + '<span class="team">' + player.team + '</span>'
                    + '</li>')
        }

        $playserSelect.addClass('show');
    });

    function getPlayerUID(player){
        return player.nom + '(' + player.team + ')';                              
    }


    function updateHtmlList(members){
        $ul = $('.large-team-list');
        //        $ul.
        //TODO: here
    }
    
    function drawAggregate(index, el){
        
        //if no element call it on js-team-aggregate elements
        if( !el ) {
            return $('.js-team-aggregate').each(drawAggregate);
        }
        
        var members = el.dataset.members,
            detail = el.dataset.detail,
            svg = d3.select(el).append("svg"),
            nDays = 38,
            w = 380,
            h = 120;
        
        days = [getMeansNoteByDay(members)];
        
        if (detail) {
            members = JSON.parse(members);
            Array.prototype.push.apply(days, members);
            updateHtmlList(members);
        }
        
        var x = d3.scaleLinear()
	    .domain([0, nDays])
	    .range([0, w]);
        
        var y = d3.scaleLinear()
	    .domain([0, 9])
	    .range([0, h]);
        
        svg.attr("width", 380)
            .attr("height", 120 * days.length);

        var season = svg.selectAll('g')
            .data(days)
            .enter().append('g')
            .attr('class', 'season')
            .attr('width', 380)
            .attr('height', 120)
            .attr('transform', function(d, i){return "translate(0, " + (i * 120) + ")";});
        ;
        
        season.selectAll("rect")
            .data(function(season){
                if( typeof season !== 'string') {
                    return season;
                }
                var member = season;
                var player = getPlayers([member])[0];
                return player.notes.map(function(note){return note.note;})
            })
            .enter().append("rect")
            .attr("class", "day")
            .attr("transform", function(d, i){
                return "translate("+x(i)+",0)";
            })
            .attr("height",  function(d){
                var val = d;
                return y(val);
            })
            .attr("y", function(d){return h - y(d)})
            .attr("width", 8)
            .style("fill", "blue")
        ;

        var g = svg.selectAll(".day")

    }
    
    dataReadyDef.done(drawAggregate);

    function getMeansNoteByDay(members){

        var players = getPlayers(members),
            days = [];

        for( var i = 0; i < 38; ++i) {
            var agg = 0;
            for( var p = 0; p < players.length; ++p) {
                var player = players[p],
                    note = player.notes[i].note;
                agg += note;
            }
            if( players.length ) agg /= players.length;
            days.push(agg);
        }
        return days;
    }

    function getPlayers(members){
        var res = [];
        for(var i = 0; i < players.length; ++i){
            var player = players[i],
                playerId = getPlayerUID(player);
            if( members.indexOf(playerId) > -1 ){
                res.push(player);
            }
        }
        return res;
    }

    //parse the csv file
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
                var tokens = cell.split(/[:\ \(\)]/).filter(function(s){return s!== "";});
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

});

