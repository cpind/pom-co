$(function(){

    $.ajaxSetup({
        headers:{"X-CSRFToken": Cookies.get('csrftoken')}
    });

    var statsmpg = {
        players:{}
    };

    
    var url = window.pomcodata,
        players = [],
        $playserSelect = $('.players-select'),
        $playersList = $('.js-players-list'),
        currentTeam = null,
        $searchTeams = $('.js-search-teams'),
        totalNumberOfDays = 38,
        dataReadyDef = new $.Deferred(),
        filterPoste = null
    ;

    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        success: function(datacsv) {
            var data = parseCSV(datacsv);
            players = data.players;
            for( var i = 0; i < players.length; ++i ){
                var p = players[i],
                    uid = getPlayerUID(p);
                statsmpg.players[uid] = p;
            }
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
    
    adjustDrawerHeight();
    refreshAggregates();
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

    //event
    $('.js-select-poste').on('change', function(e){
        var $el = $(e.target),
            val = $el.val();
        //set filter
        filterPoste = val;
        //refresh the chart
        //        refreshAggregates();
        $('.js-team-aggregate').each(function(index, el){
            var $el = $(el),
                options = $el.data('tableau-options'),
                members = options.members,
                detail = options.detail,
                reports = report_card(members, {detail:detail}),
                cardHeight = options.cardHeight
            ;
            console.log(JSON.stringify(reports.map(function(c){return c.name;})))
            svg = d3.select(el).select('svg');
            //svg.attr('height', reports.length * cardHeight);
            d3_draw_season(svg, reports);
        })

    });
    

    function getPlayerUID(player){
        return player.nom + '(' + player.team + ')';                              
    }


    function drawTeamView(){
        var $el = $('.js-team-view');
        drawAggregate(0, $el[0])
    }


    //tableau
    function refreshAggregates(){
        $('.js-team-aggregate').each(function(index, el){
            var members = JSON.parse(el.dataset.members),
                detail = el.dataset.detail || true;
            if( detail == "false")
                detail = false;
            $.when(dataReadyDef).done(function(){
                drawAggregate(el, {
                    members: members,
                    detail: detail,
                    height: 50,
                    width:$(el).width()
                });
            });
        });
    }


    function report_card(members, opt){
        var detail = opt.detail || false,
            reports = [];
        reports.push({
            name:"Team",
            notes:getMeansNoteByDay(members)
        });
        if (detail) {
            if( members.indexOf('*') > -1 ) {
                members = players.map(getPlayerUID);
            }
            if( filterPoste ) {
                members = members.filter(function(m){
                    return statsmpg.players[m].poste == filterPoste;
                })
            }            
            Array.prototype.push.apply(
                reports,
                members.map(function(m){
                    return {
                        name:get_name(m),
                        notes:get_notes(m)
                    };
                }));
        }
        return reports;
    }


    //tableau
    function drawAggregate(el, opt){
        //if no element call it on js-team-aggregate elements
        var members = opt.members,
            detail = opt.detail,
            svg = d3.select(el).append("svg"),
            nDays = 38,
            w = opt.width || 380,
            h = opt.height || 120,
            titleWidth = 100,
            noteswidth = function(){
                return w - titleWidth;
            },
            $el = $(el);
        $el.data("tableau-options", {
            members:members,
            cardHeight:h,
            detail:detail
        });
        report_cards = report_card(members, {detail:detail});
        var x = d3.scaleLinear()
	    .domain([0, nDays])
	    .range([0, noteswidth()]);
        var y = d3.scaleLinear()
	    .domain([0, 9])
	    .range([h, 2]);
        svg.attr("width", w)
            .attr("height", h * report_cards.length)
        ;

        draw_season(svg, report_cards);
        window.d3_draw_season = draw_season;
        
        function draw_season(svg, report_cards){
            var season = svg.selectAll('g.season')
                .data(report_cards);
            //UPDATE
            //no need

            //ENTER
            enter = season
                .enter()
                .append('g')
                .attr('class', 'season')
                .attr('width', w)
                .attr('height', h)
                .attr('transform', function(d, i){
                    return "translate(0, " + (i * h) + ")";
                });
            var records = enter
                .append("g")
                .attr('class', 'records')
                .attr('transform',"translate(" + titleWidth + ",0)")
                .merge(season.selectAll('g.records'))
            ;
            draw_entered(records);
            draw_notes(records);
            enter.append("g")
                .style("text-anchor", "end")
                .attr("transform", "translate(" + (titleWidth - 6) + ", " + h / 2 + ")")
                .append("text")
                .attr('class','title')
                .merge(season.select('.title'))
                .text(function(s){return s.name;})
            // season.select('.title')
            //     .text(function(s){console.log(s.name);return s.name;})
            enter.call(draw_axis);
            season
                .exit()
                .remove();
        }
        
        function draw_axis(season){
            var yAxis = d3.axisRight()
                .scale(y)
                .tickSize(-noteswidth())
                .tickFormat(function(d) { return d; })
            ;
            season.append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + w + ",0)")
            .call(yAxis)
            .selectAll("g")
            .filter(function(value) { return !value; })
                .classed("zero", true);
        }

        function draw_notes(records){
            bars = records.selectAll("rect")
                .data(function(report){
                    return report.notes.map(function(n){
                        if( isNaN(n) ) return 0;
                        return n
                    });
                });
            
            bars
                .enter().append("rect")
                .attr("class", "day")
                .merge(bars)
                .attr("transform", function(d, i){
                    return "translate("+x(i)+",0)";
                })
                .attr("height",  function(d){
                    var val = d;
                    return h - y(val);
                })
                .attr("y", function(d){return y(d)})
                .attr("width", x(1) - 2)
            //    .style("fill", "blue")
            ;
        }

        function draw_entered(records){
            records.selectAll("text.entered")
                .data(function(report){
                    return report.notes.map(function(n){
                        if( n == "<") return true;
                        return false;
                    });
                })
                .enter().append("text")
                .attr("class", "entered")
                .attr("transform", function(d, i){
                    return "translate("+x(i)+","+ h + ")";
                })
                .text(function(t){if(t) return "<"; return ""})
        }
        
        
        
    }


    function get_name(member){
        var player = getPlayers([member])[0];
        return player.nom;
    }

    // get notes for member
    function get_notes(member){
        var player = getPlayers([member])[0];
        return player.notes.map(function(note){
            return note.note;
        })
    }
    

    function getMeansNoteByDay(members){
        var players = getPlayers(members),
            days = [];
        for( var i = 0; i < 38; ++i) {
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

    function getPlayers(members){
        //if '*' returns all players
        if( members.indexOf('*') > -1 ) {
            return players;
        }
        return members.map(function(uid){
            return statsmpg.players[uid];
        });
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

