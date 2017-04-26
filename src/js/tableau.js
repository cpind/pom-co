
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
        ctx.noteScale = tableau_scaleNote(ctx);
        //height of the lines in the header showing team or poste
        ctx.groupHeaderHeight = 10;
        ctx.groupHeaderWidth = 12;
        ctx.groupHeaderWidth2 = 10;
        ctx.groupSpacing1 = 10;
        ctx.groupSpacing2 = 10;
        ctx.groupLevel = 0;
        ctx.topHeaderHeight = function(){
            return ctx.colHeaderHeight + (2 - ctx.groupLevel) * ctx.groupHeaderHeight;
        };
        ctx.labelAngle = -45;
        ctx.xoffset = function(){
                return -ctx.colHeaderHeight /
                Math.tan(ctx.labelAngle * Math.PI / 180);  
        };
        ctx.gridWidth = function() {
            var groups = ctx.groups,
                i, width = ctx.colCount * ctx.colWidth + ctx.xoffset();
            if( groups ) {
                for( i = 0; i < groups.length; ++i) {
                    width += ctx['groupSpacing' + groups[i].level];
                    if( groups[i].title) {
                        width += ctx.groupHeaderWidth;
                    }
                }
            }
            return width;
        };
    }


    function tableau_scaleDay(ctx) {
        var scale = d3
                .scaleSequential(d3.interpolateBlues)
        //        .scaleSequential(d3.interpolateRdYlGn)
                .domain([ctx.rowCount, 0]);
        return function(d) {
            return scale(d._tableau_.day);
        };
    }
    

    function tableau_scaleNote(ctx) {
        var notescale = d3
        //            .scaleSequential(d3.interpolateBlues)
        //                .scaleSequential(d3.interpolateRdYlGn)
                        .scaleSequential(d3.interpolateReds)
                .domain([0,9]);
        return function(d){
            return notescale(d.note);
        };
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
        var t = d3.transition()
                .duration(550)
        ;
        //adjust viewport
        var newheight = ctx.scalenotes(_maxSumNotes(ctx)) + 10;
        ctx.noteScale = tableau_scaleDay(ctx);
        if( !ctx.aggregate.days ) {
            var delta = tableau_height(ctx) - newheight;
            ctx.noteScale = tableau_scaleNote(ctx);
            ctx
                .body
                .transition(t)
            //credits to http://bl.ocks.org/humbletim/5507619
                .tween("scrollTween", function(){
                    var i = d3.interpolateNumber(
                        this.scrollTop,
                        this.scrollTop + delta);
                    return function(t) {
                        ctx.body.node().scrollTop = i(t);
                    };
                });
            newheight = tableau_height(ctx);
        } 
        ctx.svg.select('.players')
            .transition(t)
            .attr('transform','translate(0, '
                  + (newheight - tableau_height(ctx) )
                  + ')');
        ctx.svg
            .transition(t)
            .attr('height', newheight);
        ctx.svgRowHeader
            .transition(t)
            .attr('height', newheight);
        //        _refresh(ctx);
        ctx.svg.selectAll('.note')
            .transition(t)
            .delay(function(d){
                var p = d._tableau_.playerData,
                    day = d._tableau_.day,
                    count = playerNotesStack(ctx, p.player)[day].count;
                return (p.globalNotesCount + count) * (t.duration() / 500);
            })
            .style('fill', ctx.noteScale)
            .attr('transform', function(d){
                var y =  tableau_player_ty(ctx, d);
                return 'translate(0, ' + y + ')';
            });
        ctx.svg
            .selectAll('.dots')
            .attr('display', ctx.aggregate.days ? "none" : true);
        if( ctx.aggregate.days ) {
            var scale = d3.scaleLinear()
                    .domain([0, 9 * ctx.rowCount])
                    .range([newheight, 0]);
            var axis = d3
                    .axisLeft(scale)
                    .tickSize(5);
            ctx.svgRowHeader
                .select('.axis.y')
                .call(axis)
                .attr('transform', 'translate(' + ctx.rowHeaderWidth + ', 0)');
        }
        
        ctx.svgRowHeader.select('.rowHeaders')
            .attr('display', ctx.aggregate.days ? "none":true);
        ctx.svgRowHeader.select('.axis.y')
            .attr('display', (!ctx.aggregate.days) ? "none":true);
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
            groupkey = "", groups = [], propname;
        propname = prop;
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            if( prop ) {
                groupkey = player.player[propname];
                g = groupindex[groupkey];
            }
            if( !g ) {
                g = {
                    elements: [],
                    //used when 2 level of grouping
                    subTitle: "",
                    title: groupkey,
                    id: groupkey,
                    order: groups.length,
                    groupedby: prop,
                    x: 0,
                    y: 0,
                    //indicates level of grouping: [1, 2]
                    level: 1,
                    parent: null,
                    _initialOrder: i
                };
                groups.push(g);
                if( prop ) {
                    groupindex[groupkey] = g;
                }
            }
            g.elements.push({
                title: player.player.nom,
                player: player,
                group: g,
                x: 0,
                y: 0
            });
        }
        return groups;
    }

    function group_isGroupedBy(group, by) {
        if( group.groupedby == by ) return true;
        if( group.parent ) {
            return group_isGroupedByTeam(group.parent);
        }
        return false;
    }

    
    function group_isGroupedByTeam(group) {
        return group_isGroupedBy(group, 'team');
    }

    
    function _group_x(ctx, g) {
        var i = ctx.groups.indexOf(g),
            groups = ctx.groups.slice(),
            x = 0;
        groups.sort(function(g1, g2){return g1.order - g2.order;});
        for( i = 0; i < groups.length; ++i) {
            
        }
        
    }

    function updateGroupsPosition(ctx) {
        //compute groups position
        var groups = ctx.groups,el,
            j, i, g, elements, notescount = 0,
            posx = 0;
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
            if( g.level == 1) {
                posx += ctx.groupHeaderWidth;
            } else {
                posx += ctx.groupHeaderWidth2;
            }
            g.posx = posx;
            //sort members
            elements = g.elements;
            if( !elements ) {
                continue;
            }
            elements.sort(function(e1, e2){
                return e1.player.order - e2.player.order;
            });
            for( j = 0; j < elements.length; j ++) {
                el = elements[j];
                el.x = j;
                el.globalX = j + g.x;
                el.globalNotesCount = notescount;
                notescount += itemNotesCount(ctx, el.player);
                posx += ctx.colWidth;
            }
            if( g.level == 1) {
                posx += ctx.groupSpacing1;
            } else {
                posx += ctx.groupSpacing2;
            }
        }
        ctx.gridWidth = function(){
            return posx + ctx.xoffset();
        };
    }


    function _group_displayName(d) {
        var name = d.subTitle || d.title;
        if( !name ) {
            return name;
        }
        if( d.groupedby == 'poste') {
            name = {
                'D': 'Defender',
                'G': 'Goalkeeper',
                'A': 'Forward',
                'M': 'Middfield'
            }[name] + " (" + name + ")";
        }
        if( d.level == 2) {
        } else {
            name = name.toUpperCase();
        }
        
        return name;
    }
    
    //_group(el, 'player')
    //_group(el, 'player, poste');
    //_group(el, null); to ungroup
    function _group(el, opt) {
        opt = opt || null;
        var ctx = context(el),
            players = ctx.players,j,
            groups, svg = ctx.svg, i,
            subgroups, subgroup, groupTitle, grouplevel = 0;
        if( Array.isArray(opt) && opt.length > 1) {
            groups = _groupby(players, opt[0]);
            ctx.groups = [];
            for( i = 0; i < groups.length; ++i ) {
                players = groups[i].elements.map(function(e){return e.player;});
                
                //adds and empty group for showing title
                groupTitle = $.extend(groups[i],{
                    elements:[],
                    order:ctx.groups.length
                });
                ctx.groups.push(groupTitle);

                //adds elements
                subgroups = _groupby(players, opt[1]);
                for( j = 0; j < subgroups.length; ++j ) {
                    subgroup = subgroups[j];
                    subgroup.level = 2;
                    subgroup.id = groups[i].id + "_" + subgroups[j].id;
                    subgroup.subTitle = subgroup.title;
                    subgroup.title = null;
                    subgroup.order += ctx.groups.length;
                    subgroup._initialOrder += ctx.groups.length;
                    subgroup.parent = groups[i];
                }
                
                ctx.groups = ctx.groups.concat(subgroups);
                grouplevel = 2;
            }
        } else {
            if( Array.isArray(opt)) {
                if( opt.length == 1) {
                    opt = opt[0];
                } else if (!opt.length) {
                    opt = null;
                }
            }
            if( opt == 'team') {
                ctx.groups = _groupby(players, 'team');
                grouplevel = 1;
            }
            else if( opt == 'poste') {
                ctx.groups = _groupby(players, 'poste');
                grouplevel = 1;
            }
            else {
                ctx.groups = _groupby(players);//, function(player){return 'all';});
                grouplevel = 0;
            }
        }
        ctx.groupLevel = grouplevel;
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
        //update container width
        svg.attr('width', ctx.gridWidth());
        groups = svg
            .select('.players')
            .selectAll('.group')
            .data(ctx.groups);
        groups
            .enter()
            .append('g')
            .attr('class', 'group')
            .call(function(groups){
                groups.append('path');
                if( !opt.colHeaders ) return;
                groups.append('rect')
                    .attr('class', 'groupTitleBackground')
                    .call(tableau_selection_title_transform(ctx), -1);
                groups
                    .append('g')
                    .attr('class', 'groupTitleContainer')
                    .call(tableau_selection_title_transform(ctx), -1)
                    .call(function(selection){
                        if( selection.select('.team-symbol').empty()) {
                            selection.call(tableau_teamSymbol(ctx));
                            selection.select('.team-symbol')
                                .attr('transform', "translate(0, -4)");
                        }
                    })
                    .append('text')
                    .attr('class', 'groupTitle');
            })
            .merge(groups)
            .attr('transform', function(d) {
                var x = d.x * ctx.colWidth;
                //make space for the group title if any
                if( _group_displayName(d) ) {
                    x += ctx.groupHeaderWidth * (d.order + 1);
                }
                x = d.posx;
                return 'translate(' + x + ', 0)';
            })
            .attr('id', function(d){
                return uid_to_id(d.id);})
            .call(function(groups) {
                groups.select('.groupTitleContainer')
                    .select('.team-symbol')
                    .style('fill', function(g){
                        if( g.groupedby == 'team' )
                            return ctx.teamScale(g.id);
                        return '';})
                    .attr("opacity", function(d) {
                        return d.groupedby == 'team' ? 1 : 0;
                    })
                    .attr("opacity", function(d) {
                        return d.groupedby == 'team' ? 1 : 0;
                    });
                groups.select('.groupTitle')
                    .attr('transform', function(d){
                        var x = 0;
                        if( _group_displayName(d) && d.groupedby == 'team') {
                            x = ctx.groupHeaderHeight;
                        }
                        return 'translate(' + x + ',0)';
                    })
                    .text(function(d){
                        return _group_displayName(d);})
                    .classed('level1', function(d){
                        return d.level == 1;})
                    .classed('level2', function(d){
                        return d.level == 2;});
                groups.select('.divider')
                    .attr('d', function(d) {
                        if( !(d.title || d.subTitle)) {
                            return "";
                        }
                        var deltax = 14;
                            data = [];
                        if( opt.colHeaders ) {
                            data = [
                                [- deltax, tableau_height(ctx)],
                                [ - deltax, ctx.colHeaderHeight],
                                [ctx.xoffset() - deltax, 0]
                            ];
                        } else {
                            data = [
                                [- deltax, tableau_height(ctx)],
                                [ - deltax, 0]
                            ];
                        }
                        return d3.line()(data);
                    })
                    .attr('stroke', function(d){
                        if( d.groupedby == 'team') {
                        }
                        if( d.level == 1 ) return 'gray';
                        return 'lightgray';})
                    .style('stroke-width', ctx.groupHeaderWidth * Math.sin(Math.abs(ctx.labelAngle) * Math.PI / 180))
                    .attr('fill', 'none');
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
                    .on('mouseover', function(d){
                        selectAllPlayer(ctx, d.player, d.group)
                            .classed('selected', true);
                    })
                    .on('mouseout', function(d){
                        selectAllPlayer(ctx, d.player, d.group)
                            .classed('selected', false);
                    })
                    .call(function(enter){
                        enter
                            .append('rect')
                            .attr('class', 'glass')
                            .attr('width', ctx.colWidth)
                            .attr('height', tableau_height(ctx))
                            .attr('opacity', 0);
                        if( !opt.colHeaders ) {
                            return;
                        }
                        enter
                            .call(columnTitle, ctx)
                            .call(function(selection){
                                selection.call(tableau_teamSymbol(ctx));
                                selection.select('.team-symbol')
                                    .style('fill', function(d){
                                        return ctx.teamScale(d.player.player.team);
                                    })
                                    .attr('transform', 'translate('
                                          + (ctx.colWidth * 0.5)
                                          + ', '
                                          + (ctx.colHeaderHeight + ctx.groupHeaderHeight )
                                          + ' )');
                            });
                        enter
                            .append('text')
                            .attr('class', 'poste')
                            .attr('text-anchor', 'middle')
                            .attr('y', ctx.colHeaderHeight
                                  + 2 * ctx.groupHeaderHeight )
                            .attr('x', ctx.colWidth * 0.5)
                            .text(function(d){
                                return d.player.player.poste[0];
                            });
                        
                    })
                    .merge(players)
                    .attr('id', function(d){return uid_to_id(d.player.uid);})
                    .call(function(player){
                        player.select('.team-symbol')
                            .attr('opacity', (group.level == 2 || group_isGroupedByTeam(group))?0:1);
                        player.select('.poste')
                            .attr('opacity', (group.level == 2  || group_isGroupedBy(group, 'poste')) ? 0 : 1);
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
                                    player: d.player.uid,
                                    playerData: d
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
                        // function (d){
                        //         return ctx.noteScale(d.note);})
                            .merge(notes)//update
                            .style('fill', ctx.noteScale)
                            .attr('transform', function(d){
                                var y =  tableau_player_ty(ctx, d);
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

        if( opt.content) {
            svg.call(tableau_dots(ctx));
        }
    }

    function tableau_teamSymbol(ctx) {
        var sym = d3.symbol()
                .type(d3.symbolSquare)
                .size(50);
        return function(selection, team){
            selection.append('path')
                .attr('class', 'team-symbol')
                .attr('d', sym)
                .style('fill', function(d){
                    if( team )
                        return ctx.teamScale(team(d));
                    return 'lightgray';
                });
        };
    }

    function tableau_dots(ctx) {
        return function(selection) {
            selection
                .selectAll('.group')
                .each(function(group){
                    var sel = d3.select(this),
                        dots,data = [], i, 
                        groupColCount = group.elements.length;
                    dots = sel
                        .select('.dots');
                    for( i = 0; i < ctx.rowCount * (groupColCount + 1); ++i ) {
                        data.push(i);
                    }                    
                    if( dots.empty()) {
                        dots = sel
                            .append('g')
                            .attr('class', 'dots');
                    }
                    dots = dots
                        .selectAll('circle')
                        .data(data);
                    dots
                        .enter()
                        .append('circle')
                        .attr('cx', function(d){
                            return Math.floor(d / ctx.rowCount) * ctx.colWidth;})
                        .attr('cy', function(d) {
                            return ctx.scaley(d % ctx.rowCount);})
                        .attr('r', 1)
                        .attr('class', 'dot');
                    dots.exit().remove();
                });
        };
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
        //TODO: fix sorting group
        //TODO: figure out how sorting group is supposed to behave
//        _sortItems(ctx, ctx.groups, opt);
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
//            ctx.svgHeader.attr('height', ctx.topHeaderHeight());
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

    //operation is a funciton with a 'name' property defined which will be used
    //for caching the result in the item 
    function _itemOperation(operation) {
        return function _operation(ctx, item) {
            var res, player, notes = [], name = operation.name;
            //map argument to item
            if( typeof(item) == 'string') {
                item = playerByUID(ctx, item);
            }  else if( item.uid ) {
                item = playerByUID(ctx, item.uid);
            } else if( item.player && item.player.uid) {
                item = playerByUID(ctx, item.player.uid);
            }
            if( name && ( name in item) ) {
                return item[name];
            }
            if( item.elements ) {
                notes = item.elements.map(function(e){
                    return _operation(ctx, e);
                });
            } else {
                notes = item.player.notes;
            }
            res = operation(notes);
            if( name ) {
                item[name] = res;
            }
            return res;
        };
    }

    var _itemSumNotes = _itemOperation(_sumnotes);
    function itemSumNotes() {
        return _itemSumNotes.apply(this, arguments);
    }
    var _itemNotesCount = _itemOperation(_notescount);
    function itemNotesCount() {
        return _itemNotesCount.apply(this, arguments);
    }
    
    // function itemSumNotes(ctx, item) {
    //     var player, notes = [];
    //     if( typeof(item) == 'string') {
    //         item = playerByUID(ctx, item);
    //     }  else if( item.uid ) {
    //         item = playerByUID(ctx, item.uid);
    //     } 
    //     if( !('_sumnotes' in item ) ) {
    //         if( item.player && item.player.notes) {
    //             item._sumnotes = _sumnotes(item.player.notes);
    //         }
    //         else if( item.player && item.player.uid) {
    //             return itemSumNotes(ctx, item.player);
    //         }
    //         else if( item.elements ) {
    //             notes = item.elements.map(function(e){
    //                 return itemSumNotes(ctx, e);
    //             });
    //             item._sumnotes = _sumnotes(notes);
    //         }
    //     }
    //     return item._sumnotes;
    // }

    function _notescount(notes) {
        var j, note, count = 0;
        for( j = 0; j < notes.length; ++j ) {
            note = notes[j];
            if( note &&  typeof(note) == 'object') {
                note = note.note;
            }
            if( !note ) {
                continue;
            }
            count += 1;
        }
        return count;
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
        ctx.container = container;
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
        ctx.body = body;
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
            .attr('height', ctx.topHeaderHeight());
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
        ctx
            .svgRowHeader
            .append('g')
            .attr('class', 'axis y');
        _refreshGroups(ctx);
    }

    function _notes_data(ctx, opt) {
        opt = $.extend({
            player:null,
            playerData:null
        }, opt);
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
                    day: j,
                    playerData: opt.playerData
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
        // if( !player._stack_notes ) {
        //     player._stack_notes = _build_notes_stack(ctx, uid);
        // }
        return playerNotesStack(ctx, player)[day].ty;
    }


    function playerNotesStack(ctx, player) {
        if( !player._stack_notes ) {
            player._stack_notes = _build_notes_stack(ctx, player.uid);
        }
        return player._stack_notes;
    }
    

    function _build_notes_stack(ctx, uid) {
        var player = playerByUID(ctx, uid),
            stack = [], i,
            notes = player.player.notes, note,
            scalenotes = ctx.scalenotes,
            tot = 0, ty, count = 0;
        for( i = 0; i < notes.length; ++i ) {
            note = notes[i].note;
            if( note ) {
                tot += scalenotes(note);
            }
        }
        ty = ctx.scaley(ctx.rowCount) - tot;
        for( i = 0; i < notes.length; ++i) {
            if( i && (note = notes[i-1].note) ){
                ty += scalenotes(note);
                count += 1;
            }
            stack.push({
                ty:ty,
                count: count
            });
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
                    tx = (x == null) ? tableau_player_tx(ctx,d.player) : ctx.scalex(x);
                    tx += 5;
                    return 'translate(' + tx + ','
                        + ctx.colHeaderHeight + ') rotate(' + (-45) + ')';
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
                member.split(/[\(\)\ \.']+/);
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


    function selectAllPlayer(ctx, player, group){
        var selector = '#' + uid_to_id(player.uid);
        if( group && group.id ) {
            selector = '#' + uid_to_id(group.id) + " " + selector;
        }
        return ctx
            .container
            .selectAll(selector);
    }
})()
