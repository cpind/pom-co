(function(){

    //EXPORTS
    window.tableau = {
        init:init,
        _filterPlayer:_filterPlayer,
        _sort:_sort,
        aggregate:_aggregate,
        _group:_group
    };

    //tests:
    //tableau._filterPlayer($('.js-team-aggregate')[0],{ notes:null, poste:['G'], transition:false})
    //tableau._sort($('.js-team-aggregate')[0], '<')
    //tableau._sort($('.js-team-aggregate')[0], '>')
    //tableau._sort($('.js-team-aggregate')[0], null)
    //tableau._aggregate($('.js-team-aggregate')[0], 'days', true)
    

    //dependencies
    var d3 = window.d3;


    var transition = d3.transition()
            .duration(150)
            .ease(d3.easeLinear);

    function context(el) {
        var ctx = $(el).data('tableau-context');
        if( !ctx ) {
            ctx = {};
            $(el).data('tableau-context', ctx);
        }
        return ctx;
    }

    function update_context(el, opt){
        opt = opt || {};
        var ctx = context(el);
        ctx.rowHeight = 30;
        ctx.colWidth = 10;
        ctx.players = [];
        ctx.trimData = true;
        ctx.rowCount = 38;
        ctx.data = opt.data;
        ctx.colCount = ctx.data.playersAll.length;
        ctx.width = ctx.colCount * ctx.colWidth;
        ctx.rowHeaderWidth = 30;
        ctx.colHeaderHeight = 60;
        ctx.scalex =  d3.scaleLinear()
	    .domain([0, ctx.colCount])
	    .range([0, ctx.width]);
        ctx.scaley = d3.scaleLinear()
            .domain([0, ctx.rowCount])
            .range([0,
                    tableau_height(ctx)]);
        ctx.aggregate = {players:false, days:false};
        ctx.teams = [];
    }

    function tableau_height(ctx) {
        return ctx.rowCount * ctx.rowHeight;
    }

    //ie aggregate(el, 'player', true)
    //ie aggregate(el, 'day', true)
    //aggregate depends on the grouping and the axis each entity is in
    //aggregate stacks bars or build distibution depending on axis used for entity
    // for y axis:  uses stack
    // for x axis: uses distribution
    function _aggregate(el, entity, val) {
        var ctx = context(el);
        if( entity == 'players') {
            ctx.aggregate.players = val;
        }
        if( entity == 'days') {
            ctx.aggregate.days = val;
        }
        //adjust viewport
        var newheight = ctx.scalenotes(_maxSumNotes(ctx));
        if( !ctx.aggregate.days ) {
            newheight = tableau_height(ctx);
        }
        newheight += 10;
        ctx.svg.select('.players')
            .attr('transform','translate(0, -' + (tableau_height(ctx) -  newheight )+ ')');
        ctx.svg.attr('height', newheight);
        ctx.svgRowHeader.attr('height', newheight);
        _refresh(ctx);
    }


    function _maxSumNotes(ctx) {
        var max, i, n;//adjust the viewport
        if( '_maxnotes' in ctx ) {
            return ctx._maxnotes;
        }
        max = -1;
        for( i = 0; i < ctx.players.length; ++i ) {
            n = itemSumNotes(ctx, ctx.players[i]);
            max = ( n > max ) ? n : max;
        }
        ctx._maxnotes = max;
        return max;
    }

    function _groupby(players, prop) {
        var i, player, g, groupindex = {},
            groupkey, groups = [], propname;
        if( typeof(prop) == 'string') {
            propname = prop;
            prop = function(player){
                return player[propname];
            };
        }
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            groupkey = prop(player.player);
            g = groupindex[groupkey];
            if( !g ) {
                g = {
                    elements: [],
                    title: groupkey,
                    id: groupkey,
                    order: groups.length,
                    x: 0,
                    y: 0
                };
                groups.push(g);
                groupindex[groupkey] = g;
            }
            g.elements.push({
                title: player.player.nom,
                player: player,
                x: 0,
                y: 0
            });
        }
        return groups;
    }

    function updateGroupsPosition(ctx) {
        //compute groups position
        var groups = ctx.groups,
            j, i, g, elements;
        if(!groups) {
            return;
        }
        groups = groups.slice();
        groups.sort(function(g1, g2){
            return g1.order - g2.order;
        });
        for( i = 0; i < groups.length ; ++i) {
            g = groups[i];
            if( !i ) {
                g.x = 0;
            }else {
                g.x = groups[i-1].x + groups[i-1].elements.length;
            }
            //sort members
            elements = g.elements;
            elements.sort(function(e1, e2){
                return e1.player.order - e2.player.order;
            });
            for( j = 0; j < elements.length; j ++) {
                elements[j].x = j;
            }
        }
    }
    
    //_group(el, 'player')
    //_group(el, 'player, poste');
    //_group(el, null); to ungroup
    function _group(el, opt) {
        opt = opt || null;
        var ctx = context(el),
            players = ctx.players,
            groups, svg = ctx.svg;
        if( opt == 'team') {
            ctx.groups = _groupby(players, 'team');//function(player){ return player.team;});
        }
        else if( opt == 'poste') {
            ctx.groups = _groupby(players, 'poste');//function(player){ return player.poste;});
        }
        else {
            ctx.groups = _groupby(players, function(player){return 'all';});
        }

        _refresh(ctx);
    }

    function _refreshGroups(ctx, opt) {
        opt = $.extend({
            svg: ctx.svg,
            content: true,
            colHeaders: false
        }, opt);
        var svg = opt.svg,
            groups, players = ctx.players;
        if( !ctx.groups )  {
            ctx.groups = _groupby(players, function(){return 'all';});
        }
        updateGroupsPosition(ctx);
        groups = svg
            .select('.players')
            .selectAll('.group')
            .data(ctx.groups);
        groups
            .enter()
            .append('g')
            .attr('class', 'group')
            .call(function(group){
                if( !opt.colHeaders ) {
                    return;
                }
                group.append('rect')
                    .attr('class', 'background')
                    .attr('y', ctx.colHeaderHeight + 5)
                    .attr('height', 10);
                group.append('text')
                    .attr('class', 'groupTitle')
                    .attr('y', ctx.colHeaderHeight + 15)
                    .attr('text-anchor', 'middle');
            })
            .merge(groups)
            .call(function(group){
                if( !opt.colHeaders ) {
                    return;
                }
                group.select('.background')
                    .attr('width', function(d){
                        return d.elements.length * ctx.colWidth;
                    });
                group.select('.groupTitle')
                    .attr('x', function(d){
                        return d.elements.length * ctx.colWidth * 0.5;})
                    .text(function(d){
                        return d.title;});
            })
            .attr('transform', function(d){
                var x = d.x * ctx.colWidth;
                return 'translate(' + x + ', 0)';
            })
            .each(function(group) {
                players = d3.select(this)
                    .selectAll('.player')
                    .data(group.elements, function(d) {
                        return d.player.uid;});
                players
                    .enter()
                    .append('g')
                    .attr('class', 'player')
                    .call(function(enter){
                        if( !opt.colHeaders ) {
                            return;
                        }
                        var sym = d3.symbol()
                                .type(d3.symbolSquare)
                                .size(50);
                        enter
                            .call(columnTitle, ctx)
                            .append('path')
                            .attr('class', 'team-symbol')
                            .attr('d', sym)
                            .attr('transform', 'translate(' +(ctx.colWidth * 0.5) + ', ' + (ctx.colHeaderHeight + 10 )+ ' )')
                            .style('fill', function(d){
                                return ctx.teamScale(d.player.player.team);
                            });
                        
                    })
                    .merge(players)
                    .call(function(player){
                        if( !opt.colHeaders ) {
                            return;
                        }
                        player
                            .select('.colTitle')
                            .text(function(d, i){
                                return d.title;
                            });
                    })
                    .attr('transform', function(d) {
                        var x =  d.x * ctx.colWidth,
                            y = d.y * ctx.rowHeight;
                        return 'translate(' + x + ', ' + y + ')';
                    })
                    .each(function(d){
                        if( !opt.content ) {
                            return;
                        }
                        var color = d3.scaleSequential(d3.interpolateBlues)
                                .domain([0,9]);
                        var notes = d3.select(this)
                                .selectAll('.note')
                                .data(_notes_data(ctx, {
                                    player: d.player.uid
                                }), function(d){return d._tableau_.day;});
                        notes
                            .enter()
                            .append('rect')
                            .attr('class', 'note')
                            .attr('width', ctx.colWidth - 1)
                            .attr('height', function(d) {
                                if( !d.note ) return 0;
                                return ctx.scalenotes(d.note);
                            })
                            .style('fill', function (d){return color(d.note);})
                            .merge(notes)//update
                            .attr('transform', function(d){
                                var y =  tableau_player_ty(ctx,d);
                                return 'translate(0, ' + y + ')';
                            });
                    });
                players
                    .exit()
                    .remove();
            });
        groups
            .exit()
            .remove();
    }

    //opt could be either '<', '>' or omitted
    // omitted or falsy means revert to initial ordering
    // wehre '<' and '>' means sort by total score in ascending vs descending order
    function _sort(el, opt) {
        opt = opt || null;
        var ctx = context(el),
            players = ctx.players,
            i, player, coef = 1;
        //update order
        _sortItems(ctx, players, opt);
        _sortItems(ctx, ctx.groups, opt);
        //refresh
        _refresh(ctx);
    }

    function _sortItems(ctx, items, opt) {
        opt = opt || null;
        var coef = 1, i, item;
        if( !items) {
            return;
        }
        if( opt ) {
            if( opt == '>') {
                coef = -1;
            }
            items = items.slice().sort(function(p1, p2){
                return coef * ( itemSumNotes(ctx, p1) - itemSumNotes(ctx, p2));
            });
            for( i = 0; i < items.length; ++i ) {
                items[i].order = i;
            }
        }
        else {
            for( i = 0; i < items.length; ++i) {
                item = items[i];
                item.order = item._initialOrder;
            }
        }
        
    }

    //opt could be: {'notes':'notnull'}
    //TODO:
    //{'poste':['G', 'A']}
    //{'Team': ['PSG', 'OM']}
    function _filterPlayer(el, opt) {
        opt = opt || {};
        opt = $.extend({
            notes: null,
            poste:null,
            transition: true
        }, opt);
        var ctx = context(el),
            svg = ctx.svg,
            players = ctx.players,
            i, player;
        //update hidden status
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            player.hidden = _filterTest(ctx, opt, player);
        }
        //refresh
        _refresh(ctx, {
            transition: opt.transition
        });
    }
    
    function _filterTest(ctx, opt, player) {
        opt = $.extend({
            notes: null,
            poste: null,
            team: null
        }, opt);
        if( opt.notes == 'notnull' && !playerHasData(ctx, player.uid)) {
            return true;
        }
        if( opt.poste && opt.poste.indexOf(player.player.poste) == -1) {
            return true;
        }
        if( opt.team && opt.team.indexOf(player.player.team) == -1) {
            return true;
        }
        //TODO implement other filters
        return false;

    }

    function _refresh(ctx, opt) {
        var svg = ctx.svg;
        //options
        opt = $.extend({
            //whether to animate between two states
            transition:false
        }, opt);

        if( ctx.groups ) {
            //hide others
            svg.select('.notes')
                .attr('display', 'none');
            svg.select('.colHeaders')
                .attr('display', 'none');
            //refresh groups
            _refreshGroups(ctx, {
                svg: ctx.svgHeader,
                content: false,
                colHeaders: true
            });
            _refreshGroups(ctx);
            return;
        }
        
        //clear some caches
        ctx._players_x_ = null;
        ctx._stack_notes_dirty = true;
        //update bars position
        svg
            .selectAll('.note')
            .attr('opacity', function(p){
                if(playerByUID(ctx, p._tableau_.player).hidden) {
                    return 0;
                }
                return 1;
            })
            .call(function(selection){
                if( opt.transition ) {
                    selection = selection.transition(transition);
                }
                tableau_selection_notes_transform(ctx)(selection);
            });
        //update colheaders position 
        svg.selectAll('.colTitle')
            .attr('opacity', function(p){
                if(playerByUID(ctx, p.player).hidden) {
                    return 0;
                }
                return 1;
            })
            .call(tableau_selection_title_transform(ctx));
    }
    

    function _buildPlayerIndex(ctx) {
        var i, player,
            players = ctx.players,
            playersIndex = {};
        for( i =0 ; i < players.length; ++i) {
            player = players[i];
            playersIndex[player.uid] = player;
        }
        return playersIndex;
    }

    
    function playerByUID(ctx, uid) {
        if( !ctx._playersIndex ) {
            ctx._playersIndex = _buildPlayerIndex(ctx);
        }
        return ctx._playersIndex[uid];
    }


    // function _groupSumNotes(ctx, group) {
    //     var i, items = group.elements,
    //         tot = 0;;
    //     for( i = 0; i < items.length; ++i) {
    //         tot += itemSumNotes(ctx, items[i]);
    //     }
    //     return tot;
    // }

    function itemSumNotes(ctx, item) {
        var player, notes = [];
        if( typeof(item) == 'string') {
            item = playerByUID(ctx, item);
        }  else if( item.uid ) {
            item = playerByUID(ctx, item.uid);
        } 
        if( !('_sumnotes' in item ) ) {
            if( item.player && item.player.notes) {
                item._sumnotes = _sumnotes(item.player.notes);
            }
            else if( item.player && item.player.uid) {
                return itemSumNotes(ctx, item.player);
            }
            else if( item.elements ) {
                notes = item.elements.map(function(e){
                    return itemSumNotes(ctx, e);
                });
                item._sumnotes = _sumnotes(notes);
            }
        }
        return item._sumnotes;
    }
    
    function _sumnotes(notes) {
        var j, note, sum = null;
        for( j = 0; j < notes.length; ++j ) {
            note = notes[j];
            if( note &&  typeof(note) == 'object') {
                note = note.note;
            }
            if( !note ) {
                continue;
            }
            if( sum == null ) {
                sum = note;
                continue;
            }
            sum += note;
        }
        return sum;
    }
    
    function playerHasData(ctx, uid) {
        return itemSumNotes(ctx, uid) != null;
    }

    
    function tableau_player_order(ctx, uid) {
        return playerByUID(ctx, uid).order;
    }

    function _initTeams(ctx) {
        var i, player, teams = {}
        ;
        for( i =0 ; i < ctx.players.length; ++i) {
            player = ctx.players[i];
            teams[player.team] = 1;
        }
        //extract teams
        //todo should read from team.csv for having long name as well
        for( i in teams ) {
            ctx.teams.push(i);
        }
        ctx.teamScale = d3
            .scaleOrdinal(d3.schemeCategory20)
            .domain(ctx.teams);
        
    }

    
    function init(el, opt){
        var ctx = context(el),
            svg, i, j, player,
            days = [], info, container, teams = {};
        update_context(el, opt);
        svg = d3.select(el).select('svg');
        //init players info
        for( i =0 ; i < ctx.data.playersAll.length; ++i) {
            player = ctx.data.playersAll[i];
            info = {
                _initialOrder:i,
                order:i,
                hidden:false,
                uid: player.uid,
                player: player
            };
            ctx.players.push(info);
            teams[player.team] = 1;
        }
        _initTeams(ctx);
        ctx.rowCount = ctx.data.playersAll[0].notes.length;
        container = d3
            .select(el)
            .append('div')
            .attr('class', 'tableau-container');
        var header = container
                .append('div')
                .attr('class', 'header')
                .style('margin-left', ctx.rowHeaderWidth + "px");
        var body = container
                .append('div')
                .attr('class', 'body');
        var main = body
                .append('div')
                .attr('class', 'main');
        svg = main
            .append('svg')
            .attr('width', ctx.colCount * ctx.colWidth + 30)
            .attr('height', tableau_height(ctx));
        _sync_scroll(main, header);
        //save svg ref to ctx for future reuse
        ctx.svg = svg;
        ctx.scalenotes = d3.scaleLinear()
	    .domain([0, 9])
	    .range([0, ctx.rowHeight - 2]);
        body
            .append('div')
            .attr('class', 'east')
            .append('svg')
            .attr('width', ctx.rowHeaderWidth)
            .attr('height', tableau_height(ctx));
        ctx.svgRowHeader = d3.select(el).select('.tableau-container .east svg');
        tableau_rowHeaders(ctx, ctx.svgRowHeader
                           //d3.select(el).select('.tableau-container .east svg')
                          );
        header = header.append('svg')
            .attr('width', svg.attr('width'))
            .attr('height', ctx.colHeaderHeight)
            .append('g')
        //todo bind y translation to number of groups level?
            .attr('transform', 'translate(0, -16)');
        header
            .append('g')
            .attr('class', 'players');
        ctx.svgHeader = header;
        _refreshGroups(ctx, {
            svg: header,
            content: false,
            colHeaders: true
        });
        svg.append('g')
            .attr('class', 'players');
        _refreshGroups(ctx);
    }

    function _notes_data(ctx, opt) {
        opt = $.extend({player:null}, opt);
        var j, i, player, count,
            d, data = [],
            players = ctx.players;
        //only fetch notes for a single player
        if( opt.player ) {
            players = [playerByUID(ctx, opt.player)];
        }
        for( i = 0; i < players.length; ++i) {
            player = players[i].player;
            count = ctx.rowCount;
            for( j = 0; j < count; ++j) {
                d = player.notes[j];
                d._tableau_ = {
                    player: player.uid,
                    day: j
                };
                data.push( d );
            }
        }
        return data;
    }


    function is_days_y_axis(ctx) {
        //todo
        return true;
    }
    
    
    function tableau_player_ty(ctx, datum) {
        var d = datum,
            uid = d._tableau_.player,
            day = d._tableau_.day;
        //TODO, depends on the projection axis
        if( !(ctx.aggregate.days && is_days_y_axis(ctx)) ) {
            return ctx.scaley(d._tableau_.day)
                + ctx.rowHeight - ctx.scalenotes(d.note);
        }
        var player = playerByUID(ctx, uid);
        if( !player._stack_notes ) {
            player._stack_notes = _build_notes_stack(ctx, uid);
        }
        return player._stack_notes[day];
    }

    

    function _build_notes_stack(ctx, uid) {
        var player = playerByUID(ctx, uid),
            stack = [], i,
            notes = player.player.notes, note,
            scalenotes = ctx.scalenotes,
            tot = 0;
        for( i = 0; i < notes.length; ++i ) {
            note = notes[i].note;
            if( note ) {
                tot += scalenotes(note);
            }
        }
        stack.push(ctx.scaley(ctx.rowCount) - tot);
        for( i = 0; i < notes.length; ++i) {
            note = notes[i].note;
            if( note ) {
                stack.push(stack[stack.length - 1] + scalenotes(note));
            } else {
                stack.push(stack[stack.length - 1]);
            }
        }
        return stack;
    }

    function tableau_selection_notes_transform(ctx) {
        return function(selection) {
            var tx, ty;
            selection
                .attr('transform', function(d){
                    tx = tableau_player_tx(ctx, d._tableau_.player);
                    ty = tableau_player_ty(ctx, d);
                    return 'translate(' + tx + ','
                        +  ty + ')';
                });
        };
    }
    
    function _build_players_x_(ctx) {
        //fix ordering
        var players = ctx.players.slice(),
            info, i, player,
            playersX = {};
        players = players.filter(function(p){
            info = playerByUID(ctx, p.uid);
            return !info.hidden;
        });
        players.sort(function(p1, p2){
            return tableau_player_order(ctx, p1.uid)
                - tableau_player_order(ctx, p2.uid);
        });
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            playersX[player.uid] = ctx.scalex(i);
        }
        return playersX;
    }
    
    function tableau_player_tx(ctx, uid) {
        uid = uid.uid || uid;
        var player = playerByUID(ctx, uid),
            order = player.order;
        if( !ctx._players_x_ ) {
            ctx._players_x_ = _build_players_x_(ctx);
        }
        return ctx._players_x_[uid] || 0;
    }


    function columnTitle(selection, ctx) {
        selection.append('text')
            .attr('class', 'colTitle')
            .call(tableau_selection_title_transform(ctx), 0);
    }
    
    
    function tableau_selection_title_transform(ctx) {
        return function(selection, x){
            var tx;
            selection
                .attr('transform', function(d){
                    tx = (x == null) ? tableau_player_tx(ctx,d.player) : x;
                    tx += 5;
                    return 'translate(' + tx + ','
                        + ctx.colHeaderHeight + ') rotate(-45)';
                });
        };
    }


    function tableau_colHeaders(ctx, svg) {
        _refreshGroups(ctx, svg, true);
    }


    function tableau_rowHeaders(ctx, svg) {
        var rows = [], i;
        svg = svg || ctx.svg;
        for(i = 0; i < ctx.data.playersAll[0].notes.length; ++i) {
            rows.push({
                title: "J" + d3.format("02")(i+1),
                id: i,
                order: i
            });
        }
        
        svg.append('g')
            .attr('class', 'rowHeaders')
            .selectAll('.rowTitle')
            .data(rows)
            .enter()
            .append('text')
            .attr('class', 'rowTitle')
            .text(function(d){
                return d.title;
            })
            .attr('transform', function(d){
                return 'translate(0, ' + ctx.scaley(d.order+1) + ')';
            });        
    }


    function uid_to_id(member){
        if( !member ) {return "";}
        if( typeof(member) == 'number') {
            return "_" + member;
        }
        var id_tokens = 
                member.split(/[\(\)\ \.]+/);
        id_tokens = id_tokens.filter(function (t){ return t;});
        return id_tokens.join("__");
    }

    
    //fix shivering effect when syncing scroll between main an header
    //timeout must be big enought(ie: 10 still shows problem in my machine)
    function _sync_scroll(main, header) {
        var whoscroll = null,
            timeoutid = null;
        _on_scroll(main, header);
        _on_scroll(header, main);
        function _on_scroll(self, other) {
            self.on('scroll',function(){
                if( !whoscroll) {
                    whoscroll = self;
                }
                if( whoscroll != self ) {
                    return;
                }
                if( timeoutid ) {
                    window.clearTimeout(timeoutid);
                }
                timeoutid = window.setTimeout(function(){
                    whoscroll = null;
                    timeoutid = null;
                }, 100);
                var scrollLeft = d3.select(this).node(0).scrollLeft;
                other.node(0).scrollLeft = scrollLeft;
            });
        }
    }
    
})()
