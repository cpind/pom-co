$(function(){

    $.ajaxSetup({
        headers:{"X-CSRFToken": Cookies.get('csrftoken')}
    });

    
    var url = window.pomcodata,
        $playserSelect = $('.players-select'),
        $playersList = $('.js-players-list'),
        currentTeam = null,
        $searchTeams = $('.js-search-teams'),
        totalNumberOfDays = 38,
        dataReadyDef = new $.Deferred(),
        filterPoste = null,
        filterClub = null,
        filterName = null,
        membersToAdd = [],
        teamMembers = [],
        excludeMembers = false
    ;


    //STATES
    var REMOVE = "remove",
        ADD = "add",
        MOVES = "moves",
        VIEW = "view";

    //current state
    var state = VIEW;


    //initial state
    $('.js-done').hide();
    
    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        success: function(datacsv) {
            statsmpg.init(datacsv);
            players = statsmpg.playersAll;
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
        saveMembers(members, url)
            .done(function(data){
                //clear the list
                $playersList.empty();
                $playserSelect.removeClass('show');
                currentTeam = data;
            });
    });


    var saveMembers = function(members, url){
        return $.ajax({
            type: "POST",
            url: url,
            dataType: "json",
            data:{members:JSON.stringify(members)}
        });
    }

    
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


    //
    $('.js-done').on('click', function(event){
        var target = event.target,
            url = target.dataset.url,
            members = teamMembers,
            restoreTableau = true;
        if( !membersToAdd.length && (state != MOVES)) {
            return done();
        }
        if( state == REMOVE ) {
            members = members.filter(function(m){
                return membersToAdd.indexOf(m) == -1;
            });
            restoreTableau = false;
        } else if (state == MOVES) {
            var data = d3.selectAll('.season').data();
            sortCards(data);
            members = data
                .filter(function(m){return !m._hidden;})
                .map(function(c){return c.id;})
                .filter(function(m){return m;})
            ;
            d3.selectAll('g.season').classed('selected', false);
            restoreTableau = false;
        } else {
            members = members.concat(membersToAdd);
            d3.select('svg').classed('active', false);
        }
        saveMembers(members, url).done(done);
        function done() {
            teamMembers = members;
            $(event.target).hide();
            $('.js-edit').show();
            excludeMembers = false;
            if( restoreTableau ) {
                updateTableau({members:members});
            }
            setMode(VIEW);
        }
    })


    $('.js-add-player2').on('click', function(event){
        setMode(ADD);
        excludeMembers = true;
        var data = d3.selectAll('.season')
            .data()
            .filter(function(d){
                return !d._hidden;
            });
        if( data[0]._order == null) {
            sortCards(data);
        }
        teamMembers = data
            .map(function(d){return d.id;})
            .filter(function(m){return m;})
        ;
        updateTableau({click:function(m){
            membersToAdd.push(m);
            d3_remove_member(m);
        }});
    });


    $('.js-switch-to-remove-players').on('click', function(event){
        setMode(REMOVE);
        d3_season_on_click(
            //click:
            function(m){
                membersToAdd.push(m);
                d3_remove_member(m);
            }
        );
    });
    

    $('.js-switch-to-moves-players').on('click', function(event){
        var active = null,
            selection = d3.selectAll('svg .season')
        ;
        setMode(MOVES);
        selection
            .on('click',function(d, index, nodes){
                if( !d.id ) {
                    return;
                }
                if( !active ) {
                    active = d.id;
                    d3.select(this).classed('selected', true);
                    return;
                }
                if( active == d.id ) {
                    active = null;
                    d3.select(this).classed('selected', false);
                    return;
                }
                d3_switch_members(active, d.id);
            });
    });

    
    var setMode = function (mode) {
        state = mode;
        if( mode != VIEW ) {
            $('.js-edit').hide();
            $('.js-done').show();
            membersToAdd = [];
        }
        var data = d3.selectAll('.season')
            .data()
            .filter(function(d){
                return !d._hidden;
            });
        if( data[0]._order != null) {
            sortCards(data);
        }
        teamMembers = data
            .map(function(d){return d.id;})
            .filter(function(m){return m;})
        ;
    }
    
    
    //event
    $('.js-select-club').on('change', function(e){
        var $el = $(e.target),
            val = $el.val();
        filterClub = val;
        updateTableau(); 
    });


    $('.js-select-poste').on('change', function(e){
        var $el = $(e.target),
            val = $el.val();
        filterPoste = val;
        updateTableau();
    });


    $('.js-search-name').on('input', function(e){
        var $el = $(e.target),
            val = $el.val();
        if(!val || val == ""){
            $el.val("");
        }
        filterName = val;
        updateTableau()
    })


    function tableauOptions(){
        return $('.js-team-aggregate').data('tableau-options');
    }
    
    
    function updateTableau(opt){
        var opt = opt || {};
        $('.js-team-aggregate').each(function(index, el){
            var $el = $(el),
                options = $el.data('tableau-options'),
                //TODO: clarify option settings
                members = opt.members || options.members,
                detail = options.detail,
                cardHeight = options.cardHeight
            ;
            tableau_update(members, {click:opt.click, detail:detail});
        });
    }
    

    function getPlayerUID(player){
        return statsmpg.playerUID(player);
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
            members = members.filter(function(m){return m;});
            teamMembers = members;
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
            exclude = excludeMembers,
            reports = [];
        if( exclude ) {
            var newMembers = []
            for( var key in statsmpg.players){
                if( members.indexOf(key) == - 1) {
                    newMembers.push(key);
                }
            }
            members = newMembers;
        }
        reports.push({
            name:"Team",
            notes:getMeansNoteByDay(members)
        });
        if (!detail) {
            return reports;
        }
        if( members.indexOf('*') > -1 ) {
            members = players.map(getPlayerUID);
        }
        if( filterPoste ) {
            members = members.filter(function(m){
                return statsmpg.players[m].poste == filterPoste;
            })
        }
        if( filterClub ) {
            members = members.filter(function(m){
                return statsmpg.players[m].team == filterClub;
            })
        }
        if( filterName ) {
            var search = filterName.toLowerCase();
            members = members.filter(function(m){
                return statsmpg.players[m].nom.toLowerCase().indexOf(search) > -1;
            })
        }
        Array.prototype.push.apply(
            reports,
            members.map(function(m){
                return {
                    name:get_name(m),
                    notes:get_notes(m),
                    id:m
                };
            }));
        return reports;
    }


    //tableau
    function drawAggregate(el, opt){
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
        report_cards = report_card(members, {detail:detail});
        $el.data("tableau-options", {
            members:members,
            cardHeight:h,
            detail:detail
        });
        var x = d3.scaleLinear()
	    .domain([0, nDays])
	    .range([0, noteswidth()]);
        var y = d3.scaleLinear()
	    .domain([0, 9])
	    .range([h, 2]);
        svg.attr("width", w);

        draw_season(svg, report_cards);
        //@deprecated -> tableau_update
        window.tableau_update = tableau_update;
        window.d3_remove_member = remove_member;
        window.d3_switch_members = switch_members;


        var transition = d3.transition()
            .duration(150)
            .ease(d3.easeLinear);

        function initCardOrder(data){
            data.forEach(function(c, i){
                c._order = i;
            });
        }

        function findCard(data, member){
            for( var i = 0; i < data.length; i++){
                var id = data[i].id;
                if( id == member ) {
                    return i;
                }
            }
            return -1;
        }


        function switch_members(m1, m2){
            var tr2 = selectMember(m2)
                .attr('transform'),
                data = svg.selectAll('g.season').data();
            selectMember(m1)
                .transition(transition)
                .attr('transform', tr2);
            //data with order
            if( data[0]._order == null) {
                initCardOrder(data);
            }
            sortCards(data);
            //find members position
            var i1 = findCard(data, m1),
                i2 = findCard(data, m2);
            //switch the position
            var data1 = data.splice(i1,1)[0];
            data.splice(i2, 0, data1);
            initCardOrder(data);
            //transform
            svg
                .selectAll('g.season')
                .each(function(d, i, nodes){
                    newindex = d._order;
                    transform(d3.select(this)
                              .transition(transition), newindex);
                });
        }

        function selectMember(m) {
            return svg
                .select("#" + uid_to_id(m));
        }

        function remove_member(member) {
            svg.select("#" + uid_to_id(member))
                .remove();
            var data = svg.selectAll('.season').data();
            if( data[0]._order == null) {
                initCardOrder(data);
            }
            sortCards(data);
            //find members position
            initCardOrder(data);
            svg
                .selectAll('g.season')
                .transition(transition)
                .call(transform);
        }


        function uid_to_id(member){
            if( !member ) {return "";}
            var id_tokens = 
                member.split(/[\(\)\ \.]+/);
            id_tokens = id_tokens.filter(function (t){ return t;})
            return id_tokens.join("__");
        }

        window.d3_season_on_click = function(listener){
            var svg = d3.select('svg'),
                season = svg.selectAll('g.season')
            season_on_click(season, listener);
        }

        function season_on_click(sel, listener){
            var svg = d3.select('svg');
            if( listener ) {
                svg.classed("active", true);
                sel
                    .on('click', 
                        function(d, index, nodes) {
                            if( !d.id ) { return; }
                            listener.call(this, d.id);
                        });
            } else {
                svg.classed("active", false);
                sel.on('click', null);
            }
        }

        function tableau_update(members, opt) {
            var opt = opt || {},
                detail = opt.detail,
                svg = d3.select('svg'),
                reportCards = report_card(members, {detail:detail});
            draw_season(svg, reportCards, opt);
            
        }

        //internal of  d3_draw_season
        function draw_season(svg, report_cards, opt){
            var opt = opt || {},
                click = opt.click || null,
                season = svg.selectAll('g.season')
                .data(report_cards);
            updateOptions({report_cards:report_cards});
            svg
                .attr("height", h * report_cards.length + 2);
            enter = season
                .enter()
                .append('g')
                .attr('class', 'season')
                .call(setSize)
                .call(transform);

            enter.merge(season)
                .attr('id', function(d){return uid_to_id(d.id);})
                .attr("opacity", 1)
                .each(function(d){d._hidden=false;});
            season_on_click(enter.merge(season), click);
            var records = enter
                .append("g")
                .attr('class', 'records')
                .attr('transform', "translate(" + titleWidth + ",0)")
                .merge(season.select('g.records'));            
            draw_entered(records);
            draw_notes(records);
            thumbnail = enter
                .append("g")
                .style("text-anchor", "end")
                .attr("transform", "translate("
                      + (titleWidth - 6) + ", "
                      + h / 2 + ")");
            thumbnail
                .append("text")
                .attr('class', 'title')
                .merge(season.select('.title'))
                .text(function(s){return s.name;})
            thumbnail
                .append("text")
                .attr('class', 'club')
                .attr('y', 15)
                .merge(season.select('.club'))
                .text(function(s){
                    if (s.name == "Team") {
                        return "";
                    }
                    p = statsmpg.players[s.id];
                    
                    return p.team + " - " + p.poste;
                })
            enter.call(draw_axis);
            enter
                .append('rect')
                .attr('class', 'season-glass')
                .call(setSize)
                .attr('opacity', 0);            
            season.exit()
                .attr('id', "")
                .attr("opacity", 0)
                .each(function(d){
                    d._hidden = true;
                })
            ;
        }


        function transform(sel, i){
            var y = function(index){
                return index * h;
            }
            if( i != null) {
                y = function(){
                    return i * h;
                }
            }
            return sel.attr('transform', function(d, i) {
                var ii = i;
                if( d._order != null) {
                    ii = d._order;
                }
                return "translate(0, " + y(ii) + ")";
            })
        }
        
        function setSize(sel){
            sel.attr('width', w)
                .attr('height', h);
            return sel;
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
                .attr("transform", function(d, i){
                    return "translate("+x(i)+",0)";
                })
                .merge(bars)
                .attr("height",  function(d){
                    var val = d;
                    return h - y(val);
                })
                .attr("y", function(d){return y(d)})
                .attr("width", x(1) - 2);
        }

        function draw_entered(records){
            arrow = records.selectAll("text.entered")
                .data(function(report){
                    return report.notes.map(function(n){
                        if( n == "<") return true;
                        return false;
                    });
                });
            arrow
                .enter().append("text")
                .attr("class", "entered")
                .attr("transform", function(d, i){
                    return "translate("+x(i)+","+ h + ")";
                })
                .merge(arrow)
                .text(function(t){if(t) return "<"; return ""})
        }

        function updateOptions(opt){
            var opt = opt || {};
            if( !opt.report_cards ) {
                    return;
            }
            var members = opt.report_cards.map(function(c){return c.id;});
            members = members.filter(function (m){return m;})
            $el.data("tableau-options").members = members;
        }
    }


    //UTILITIES & ALIASES
    function sortCards(cards){
        cards.sort(function(d1, d2){
            return d1._order - d2._order;
        });            
    }
        

    function get_name(member){
        return statsmpg.players[member].nom;
    }


    function get_notes(member){
        var player = statsmpg.players[member];
        return player.notes.map(function(note){
            return note.note;
        })
    }
    

    function getMeansNoteByDay(members){
        return statsmpg.meansByDay(members);
    }

    function getPlayers(members){
        return statsmpg.playersGet(members);
    }


});

