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
        ctx.rowHeight = 50;
        ctx.colWidth = 10;
        ctx.players = [];
        ctx.trimData = true;
        ctx.rowCount = 38;
        ctx.data = opt.data;
        ctx.colCount = ctx.data.playersAll.length;
        ctx.width = ctx.colCount * ctx.colWidth;
        ctx.rowHeaderWidth = 30;
        ctx.colHeaderHeight = 50;
        ctx.scalex =  d3.scaleLinear()
	    .domain([0, ctx.colCount])
	    .range([ctx.rowHeaderWidth, ctx.width]);
        ctx.scaley = d3.scaleLinear()
            .domain([0, ctx.rowCount])
            .range([ctx.colHeaderHeight,
                    tableau_height(ctx)]);
        ctx.aggregate = {players:false, days:false};
    }

    function tableau_height(ctx) {
        return ctx.rowCount * ctx.rowHeight + ctx.colHeaderHeight;
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
        _refresh(ctx);
    }


    function _groupby(players, prop) {
        var i, player, g, groupindex = {},
            groupkey, groups = [];
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
            ctx.groups = _groupby(players, function(player){ return player.team;});
        }
        else if( opt == 'poste') {
            ctx.groups = _groupby(players, function(player){ return player.poste;});
        }
        else {
            ctx.groups = _groupby(players, function(player){return 'all';});
        }

        _refresh(ctx);
    }

    function _refreshGroups(ctx) {
        var svg = ctx.svg, groups,
            players = ctx.players;
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
                var x = d.x * ctx.colWidth + ctx.rowHeaderWidth;
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
                    .call(function(player){
                        player.append('text')
                            .attr('class', 'colTitle')
                            .call(tableau_selection_title_transform(ctx), 0);
                    })
                    .merge(players)
                    .call(function(player){
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


    function _groupSumNotes(ctx, group) {
        var i, items = group.elements,
            tot = 0;;
        for( i = 0; i < items.length; ++i) {
            tot += itemSumNotes(ctx, items[i]);
        }
        return tot;
    }

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

    function init(el, opt){
        var ctx = context(el),
            svg, i, j, player,
            days = [], info;
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
        }
        ctx.rowCount = ctx.data.playersAll[0].notes.length;
        svg = d3
            .select(el)
            .append('svg')
            .attr('width', ctx.rowHeaderWidth + ctx.colCount * ctx.colWidth + 30)
            .attr('height', tableau_height(ctx));
        //save svg ref to ctx for future reuse
        ctx.svg = svg;
        ctx.scalenotes = d3.scaleLinear()
	    .domain([0, 9])
	    .range([0, ctx.rowHeight - 2]);
//        tableau_notes(ctx, svg);
        tableau_rowHeaders(ctx);
//        tableau_colHeaders(ctx);
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

    function tableau_notes(ctx, selection) {
        var data = _notes_data(ctx);
        selection
            .append('g')
            .attr('class', 'notes')
            .selectAll('.note')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'note')
            .call(tableau_selection_notes_transform(ctx))
            .attr('width', ctx.colWidth - 1)
            .attr('height', function(d) {
                if( !d.note ) return 0;
                return ctx.scalenotes(d.note);
            });        
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

    
    function tableau_colHeaders(ctx) {
        var svg = ctx.svg,
            columns = [], i,
            players = ctx.data.playersAll,
            col,
            player, info;
        for(i = 0; i < players.length; ++i) {
            player = players[i];
            info = playerByUID(ctx, player.uid);
            col = {
                title: player.nom,
                player: player.uid,
                order: info.order,
                hidden: false
            };
            col.title = (!playerHasData(ctx, player.uid) ? "::" : "") + col.title;
            columns.push(col);
        }
        svg.append('g')
            .attr('class', 'colHeaders')
            .selectAll('.colTitle')
            .data(columns)
            .enter()
            .append('text')
            .attr('class', 'colTitle')
            .text(function(d, i){ return d.title;})
            .call(tableau_selection_title_transform(ctx));
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

    function tableau_rowHeaders(ctx) {
        var svg = ctx.svg,
            rows = [], i;
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

    
})()
