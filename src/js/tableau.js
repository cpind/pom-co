
(function(){

    //EXPORTS
    window.tableau = {
        init:init,
        _filterPlayer:_filterPlayer,
        _sort:_sort,
        aggregate:_aggregate,
        _group:_group,
        _filterDays:_filterDays
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
            ctx = {
                el:el
            };
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
        ctx.xoffset = function() {
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
                .scaleSequential(d3.interpolateBlues)//d3.interpolateRdYlGn
                .domain([ctx.rowCount, 0]);
        return function(d) {
            return scale(d._tableau_.day);
        };
    }
    

    function tableau_scaleNote(ctx) {
                //tryed with d3.interpolateBlues and d3.interpolateRdYlGn
        var notescale = d3
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
        var ctx = context(el),
            players = ctx.svg.select('.players');
        ctx.svg.call(tableau_select(ctx), 'player');
        if( entity == 'players') {
            ctx.aggregate.players = val;
        }
        if( entity == 'days') {
            ctx.aggregate.days = val;
        }
        //clear stacks;
        ctx._stacks = null;
        var t = d3.transition()
                .duration(550);
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
        ctx.svg
            .select('.players')
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
        var playerStacks = {};
        ctx.svg
            .select('.players')
            .selectAll('.note[opacity="1"]')
            .transition(t)
            .delay(function(d){
                var p = d._tableau_.playerData,
                    day = d._tableau_.day,
                    count = playerNotesStack(ctx, p.player)[day].count;
                return (p.globalNotesCount + count) * (t.duration() / 500);
            })
            .style('fill', ctx.noteScale)
            .attr('transform', tableau_noteTransform(ctx));
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
        ctx.svgRowHeader
            .select('.rowHeaders')
            .attr('display', ctx.aggregate.days ? "none":true);
        ctx.svgRowHeader
            .select('.axis.y')
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
                    _initialOrder: i,
                    hidden: true
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
            if( !player.hidden ) {
                g.hidden = false;
            }
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
        groups = groups.slice().filter(function(g) {return !g.hidden;});
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
            elements = g.elements.filter(function(e){return !e.player.hidden;});
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
        //switch to document by player 
        ctx.svg
            .call(tableau_select(ctx), 'player');
        _refresh(ctx);
    }


    function _filter(ctx, opt) {
        opt = $.extend({
            teams:[],
            postes:[]
        }, opt);
        var i,
            j,
            g,
            player,
            anyvisible,
            anyfilter = (opt &&
                         (opt.teams &&opt.teams.length ||
                          opt.postes && opt.postes.length));
        for(i = 0; i < ctx.groups.length; ++i) {
            g = ctx.groups[i];
            g.hidden = anyfilter;
        }
        for(i = 0; i < ctx.groups.length; ++i) {
            g = ctx.groups[i];
            for( j = 0; j < g.elements.length; ++j){
                player = g.elements[j].player;
                player.hidden = anyfilter;
                if( ((opt.teams.length == 0)
                     || opt.teams.indexOf(player.player.team) > -1) &&
                    (!opt.postes.length
                     || opt.postes.indexOf(player.player.poste) > -1)) {
                    player.hidden = false;
                    g.hidden = false;
                    if( g.parent ) {
                        g.parent.hidden = false;
                    }
                }
            }
        }
        _refresh(ctx);
    }
    
    //create a new group generator for players
    function tableau_groupPlayer(ctx) {
        var players = ctx.players;
        if( !ctx.groups )  {
            ctx.groups = _groupby(players, function(){return 'all';});
        }
        updateGroupsPosition(ctx);
        return function(selection) {
            var groups;
            groups = selection
                .selectAll('.group')
                .data(ctx.groups);
            groups
                .enter()
                .append('g')
                .attr('class', 'group')
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
                .attr('opacity', function(d){
                    return d.hidden ? 0 : 1;});
            groups.exit().remove();
        };
    }
    

    //create a new generator for players
    function tableau_player(ctx) {
        var players;
        return function(selection){
            selection
                .call(tableau_groupPlayer(ctx))
                .selectAll('.group')
                .each(function(group){
                    players = d3.select(this)
                        .selectAll('.player')
                        .data(group.elements, function(d) {
                            return d.player.uid;});
                    players
                        .enter()
                        .append('g')
                        .attr('class', 'player')
                        .merge(players)
                        .attr('id', function(d){return uid_to_id(d.player.uid);})
                        .attr('transform', function(d) {
                            var x =  d.x * ctx.colWidth,
                                y = d.y * ctx.rowHeight;
                            return 'translate(' + x + ', ' + y + ')';
                        })
                        .attr('opacity', function(d){
                            return d.player.hidden ? 0: 1;});
                    players
                        .exit()
                        .remove();
                });
        };
    }


    function tableau_playerSelected(ctx){
        return function(selection){
            selection
                .call(tableau_player(ctx))
            //                .call(function(selection
                .selectAll('.player')
                .each(function(d){
                    if( !d3.select(this)
                        .select('rect.glass')
                        .empty()) {
                        return;
                    }
                    d3.select(this)
                        .insert('rect', '*')
                        .attr('class', 'glass')
                        .attr('width', ctx.colWidth)
                        .attr('height', tableau_height(ctx))
                        .attr('opacity', 0);
                })
                .on('mouseover', function(d){
                    selectAllPlayer(ctx, d.player, d.group)
                        .classed('selected', true);
                })
                .on('mouseout', function(d){
                    selectAllPlayer(ctx, d.player, d.group)
                        .classed('selected', false);
                });
        };
    }

    function tableau_noteTransform(ctx) {
        var playerStacks = {};
        return function(d){
            var y;
            if( ctx.aggregate.days ) {
                var player = playerByUID(ctx, d._tableau_.player),
                    stack = playerNotesStack(ctx, player),//playerStacks[player.uid],
                    day = d._tableau_.day,
                    uid = player.uid;
                if( !stack) {
                    stack = _build_notes_stack(ctx, uid);
                    playerStacks[uid] = stack;
                }
                y =  stack[day].ty;
            } else {
                y = tableau_player_ty(ctx, d);
            }
            return 'translate(0, ' + y + ')';
        };
    }
    
    function tableau_notes(ctx) {
        return function(selection, day){
            var notes = selection
                    .call(tableau_player(ctx))
                    .selectAll('.player')
                    .selectAll('.note')
                    .data(function(d){
                        if( !day && !ctx.svg.select('.days').empty()) {
                            //sync with days in document grouped by day
                            day = ctx
                                .svg
                                .select('.days')
                                .selectAll('.day[opacity="1"]')
                                .data();
                        }
                        var data = _notes_data(ctx, {
                            player: d.player.uid,
                            playerData: d,
                            day: day
                        });
                        return data;
                    }, function(d){return d._tableau_.day;});
            var notetransform = tableau_noteTransform(ctx);
            notes
                .enter()
                .append('rect')
                .attr('class', 'note')
                .attr('width', ctx.colWidth - 1)
                .attr('height', function(d) {
                    if( !d.note ) return 0;
                    return ctx.scalenotes(d.note);
                })
                .on('mouseover', function(d){
                    if( !ctx.aggregate.days) {
                        return;
                    }
                    //TODO show the aggregate value on the axis
                    //console.log(d.note);
                })
                .merge(notes)//update
                .attr('opacity', function(d){
                    if( !d.note) return 0;
                    return 1;
                })
                .style('fill', ctx.noteScale)
                .attr('transform', function(d){
                    var y;// =  tableau_player_ty(ctx, d);
                    if( day && !Array.isArray(day) ) {
                        return 'translate(0, 0)';
                    }
                    return notetransform(d);
                })
//                .attr('transform', tableau_noteTransform(ctx))
            ;
            notes.exit()
                .attr('opacity', function(){
                    return 0;
                });
        };
    }


    function tableau_bevel(ctx) {
        var width = 2 * ctx.colWidth;
        return function(selection){
            var sidepanel = selection;
            selection
                .style('position', 'relative')
                .style('height', '100%')
                .append('svg')
                .style('position', 'absolute')
                .style('left', -width)
                .style('width', width)
                .style('top', 0)
                .style('height', '100%')
                .call(function(selection){
                    selection
                        .append('path')
                        .attr('d', d3.line()([
                            [0, ctx.colHeaderHeight],
                            [ 2 * ctx.colWidth, ctx.colHeaderHeight],
                            [2 * ctx.colWidth, ctx.colHeaderHeight + (Math.tan(ctx.labelAngle * Math.PI / 180) * 2 * ctx.colWidth)]
                        ]));
                    selection
                        .append('rect')
                        .attr("width", 2 * ctx.colWidth)
                        .attr('height', "100%")
                        .attr('y', ctx.colHeaderHeight);
                    selection
                        .style('fill', '#eeeeee');
                    
                    selection.on('click', function(){
                        sidepanel.classed('show', !sidepanel.classed('show'));
                    });
                });
            selection
                .append('span')
                .attr('class', 'glyphicon glyphicon-chevron-left')
                .style('position', 'absolute')
                .style('left', "-16px")
                .style('top', "65px")
                .on('click', function(){
                    sidepanel.classed('show', !sidepanel.classed('show'));
                });
        };
    }

    function tableau_paramSectionTitle(ctx) {
        return function(selection, title){
            selection.append('h4')
                .append('a')
                .attr('href', 'javascript:void(0);')
                .attr('data-toggle', 'collapse')
                .attr('data-target', '#section_' + title.split(' ')[0])
                .style('display', 'block')
                .html(title);
        };
    }

    function tableau_params(ctx) {
        var title = tableau_paramSectionTitle(ctx),
            content = tableau_paramSectionContent(ctx);
        return function(selection){
            selection
                .call(title, 'Aggregate')
                .call(function(sel){
                    sel
                        .call(content, 'Aggregate');
                    sel
                        .select('#section_Aggregate')
                        .append('ul')
                        .call(function(selection){
                            selection
                                .append('li')
                                .call(tableau_paramCheckboxItem(ctx), 'days')
                                .select('a')
                                .on('click.action', function(d){
                                    return _aggregate(ctx.el, 'days', d3.select(this).select('input').property('checked'));
                                });
                            //TODO
                            // selection
                            //     .append('li')
                            //     .call(tableau_paramCheckboxItem(ctx), 'player');
                        });
                })
                .call(title, 'Group by')
                .call(content, 'Group by')
                .call(function(selection){
                    selection
                        .select('#section_Group')
                        .html('<select data-placeholder="Group by ..." class="chosen-select" multiple style="width:170px;">'
                                +'<option value="team">Team</option>'
                                +'<option value="poste">Poste</option>'
                              + '</select>');
                    var el = selection.select('select').node();
                    window.mbt.chosen(el);
                    $(el).on('chosen:changeInOrder', function(event, val){
                        _group(ctx.el, val);
                    });
                })
                .call(title, 'Sort')
                .call(content, 'Sort')
                .call(function(selection){
                    var item = tableau_paramItem(ctx);
                    selection = selection.select('#section_Sort')
                        .append('ul');
                    selection
                        .call(item, 'Ascending',
                              {'click': function(){return _sort(ctx.el, '<');}});
                    selection
                        .call(item, 'Descending', {'click': function(){return _sort(ctx.el, '>');}});
                    selection
                        .call(item, 'Initial',{'click':function(){return _sort(ctx.el, null);}});
                    ;
                    // selection
                    //     .call();
                })
                .call(title, 'Days')
                .call(content, 'Days')
                .call(function(selection){
                    selection = selection
                        .select('#section_Days')
                        .append('div')
                        .attr('id', 'slider-range');
                    $(selection.node()).slider({
                        range:true,
                        min: 0,
                        max: 38,
                        values: [0,38],
                        slide: function( event, ui ) {
                            _filterDays(ctx.el, ui.values);
                        }
                        
                    });
                })
                .call(tableau_filter(ctx))
                .call(tableau_filter(ctx), 'poste');
        };
    }

    function tableau_paramItem(ctx) {
        return function(selection, title, opt){
            opt = $.extend({}, opt);
            selection
                .append('li')
                .html('<a href="javascript:void(0);"></a>')
                .select('a')
                .html(title)
                .call(function(selection){
                    if( !opt.click) {return;}
                    selection.on('click', opt.click);
                })
            ;
        };
    }

    
    function tableau_paramCheckboxItem(ctx) {
        return function(selection, title) {
            selection
                .html('<a href="javascript:void(0);"></a>')
                .select('a')
                .on('click', function(d){
                    if( d3.event.target.type != 'checkbox' ) {
                        var checked = d3
                                .select(this)
                                .select('input')
                                .property('checked');
                        d3.select(this)
                            .select('input')
                            .property('checked', !checked);
                    }
                })
                .html('<input type="checkbox">' + title);
        };
    }

    function tableau_paramSectionContent(ctx) {
        return function(selection, title){
            //for "group by" case
            title = title.split(' ')[0];
            selection
                .append('div')
                .attr('id', 'section_'+title)
                .attr('class', 'collapse in');
        };
    }
    
    function tableau_filter(ctx) {
        var property = 'team',
            data = d3.nest()
                .key(function(d){return d.player[property];})
                .rollup(function(leaves){return leaves.length;});
        return function(selection, prop){
            prop = prop || 'team';
            property = prop;
            selection
                .call(tableau_paramSectionTitle(ctx), property);
            selection
                .call(tableau_paramSectionContent(ctx), property);
            var teams = selection
                    .select('#section_'+property)
                    .append('ul')
                    .attr('class', 'team-filter ' + property);
            var ul = teams;
            teams
                .call(tableau_paramItem(ctx), 'Clear')
                .select('a')
                .on('click', function(){
                    //reset checkboxes
                    ul
                        .selectAll('.team')
                        .select('input')
                        .property('checked', false);
                    tableau_selectedFilter(ctx, selection);
                });
            teams = teams
                .selectAll('.team')
                .data(data.entries(ctx.players));
            teams
                .enter()
                .each(function(d){
                    var sel = d3.select(this);
                    sel
                        .append('li')
                        .attr('class', 'team')
                        .call(tableau_paramCheckboxItem(ctx), d.key)
                        .select('a')
                        .on('click.selectfilter', function(d){
                            tableau_selectedFilter(ctx, selection);
                        });
                });

        };
    }


    

    function tableau_selectedFilter(ctx, selection){
        var selectedTeams = selection
                .selectAll('ul.team .team')
                .filter(function(){
                    var input = d3.select(this).select('input');
                    return input.size() && input.property('checked');
                })
                .data()
                .map(function(d){return d.key;});
        
        var selectedPostes = selection
                .selectAll('ul.poste .team')
                .filter(function(){
                    var input = d3.select(this).select('input');
                    return input.size() && input.property('checked');
                })
                .data()
                .map(function(d){return d.key;});
        
        _filter(ctx,{'teams':selectedTeams, 'postes':selectedPostes});
        
    }
    
    //create a new axis generator for players
    function tableau_axisPlayer(ctx) {
        return function(selection){
            selection
                .call(tableau_player(ctx))
                .call(tableau_playerSelected(ctx));
            selection
                .selectAll('.group')
                .each(function(d){
                    var group = d3.select(this);
                    if(!group.select('.groupTitleContainer').empty()) {
                        return;
                    }
                    group
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
                .call(function(groups){
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
                });
            selection
                .selectAll('.group')
                .each(function(group){
                    var players = d3
                            .select(this)
                            .selectAll('.player');
                    players
                        .each(function(){
                            var player = d3.select(this);
                            if(! player.select('.colTitle').empty()) {
                                return;}
                            //init player 
                            player
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
                            player
                                .append('text')
                                .attr('class', 'poste')
                                .attr('text-anchor', 'middle')
                                .attr('y', ctx.colHeaderHeight
                                      + 2 * ctx.groupHeaderHeight )
                                .attr('x', ctx.colWidth * 0.5)
                                .text(function(d){
                                    return d.player.player.poste[0];
                                });
                        });
                    players
                        .select('.team-symbol')
                        .attr('opacity', (group.level == 2 || group_isGroupedByTeam(group))?0:1);
                    players
                        .select('.poste')
                        .attr('opacity', (group.level == 2  || group_isGroupedBy(group, 'poste')) ? 0 : 1);
                    players
                        .select('.colTitle')
                        .text(function(d, i){
                            return d.title;
                        });
                });
        };
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
        ctx.svg.call(tableau_select(ctx), 'player');
        ctx.svg.call(tableau_player(ctx));
        ctx.svgHeader.call(tableau_player(ctx));
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

    
    function _filterDays(el, range) {
        var ctx = context(el),
            svg = ctx.svg,
            players = svg.select('.players'),
            days = ctx.svg.select('.days');
        if( ctx.aggregate.days ) {
            //todo
        } else {
            //should be moved into tableau_select(ctx), 'day'
            if(players.attr('display') != "none"){
                if( days.empty()) {
                    //init group by days
                    days = ctx.svg.append('g')
                        .attr('class', 'days');
                    days.append('g')
                        .attr('class', 'listener');
                }
                days
                    .call(tableau_days(ctx), range)
                    .selectAll('.day')
                    .attr('transform', function(d){
                        var tr = d3.select(this).attr('transform'),
                            sc = "scale(1, -1)";
                        if( !tr.endsWith(sc) ) {
                            tr = tr + sc;
                        }
                        return tr;
                    })
                    .each(function(d){
                        d3.select(this)
                            .call(tableau_notes(ctx), d);
                    });
                //update days
                days.select('.listener')
                    .call(tableau_playerSelected(ctx));
                players.attr('display', 'none');
                days.attr('display', 'true');
            }
            days
                .call(tableau_days(ctx), range)
                .selectAll('.day')
                .attr('transform', function(d){
                    var tr = d3.select(this).attr('transform'),
                        sc = "scale(1, -1)";
                    if( !tr.endsWith(sc) ) {
                        tr = tr + sc;
                    }
                    return tr;
                });
            ctx
                .svgRowHeader
                .select('.rowHeaders')
                .call(tableau_days(ctx), range);
        }
    }


    function tableau_select(ctx) {
        return function(selection, mode){
            if( mode == 'player' ) {
                if( selection
                    .select('.players')
                    .attr('display') != 'none') {
                    return;
                }
                selection
                    .select('.players')
                    .attr('display', 'true')
                    .call(tableau_notes(ctx));
                selection
                    .select('.days')
                    .attr('display', 'none');
            } else if( mode == 'day') {
                
            }
        };
    }

    
    //refresh the document by players
    function _refresh(ctx, opt) {
        var svg = ctx.svg;
        //options
        opt = $.extend({
            //whether to animate between two states
            transition:false
        }, opt);
        //hide others
        svg.select('.notes')
            .attr('display', 'none');
        svg.select('.colHeaders')
            .attr('display', 'none');
        //switch to group by players if not already
        ctx.svg.call(tableau_select(ctx), 'player');
        //refresh groups
        ctx
            .svgHeader
            .select('.players')
            .call(tableau_axisPlayer(ctx));
        ctx
            .svg
            .select('.players')
            .call(tableau_notes(ctx))
            .call(tableau_dots(ctx));
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
            .attr('class', 'main-container')
            .append('div')
            .attr('class', 'tableau-container');
        var mainContainer = d3.select(el).select('.main-container');
        var side = mainContainer
                .append('div')
                .attr('class', 'sidepanel show')
                .append('div')
                .attr('class', 'contentWrapper')
                .append('div')
                .attr('class', 'content');
        side.call(tableau_params(ctx));
//        side.call(tableau_filter(ctx), 'poste');
        mainContainer
            .select('.sidepanel')
            .call(tableau_bevel(ctx));
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
        ctx.svgRowHeader = body.select('.east svg');
        tableau_rowHeaders(ctx, ctx.svgRowHeader);
        header = header.append('svg')
            .attr('width', svg.attr('width'))
            .attr('height', ctx.topHeaderHeight());
        header
            .append('g')
            .attr('class', 'players');
        ctx.svgHeader = header;
        header
            .select('.players')
            .call(tableau_axisPlayer(ctx));
        svg.append('g')
            .attr('class', 'players');
        ctx
            .svgRowHeader
            .append('g')
            .attr('class', 'axis y');
        ctx
            .svg
            .select('.players')
            .call(tableau_notes(ctx))
            .call(tableau_playerSelected(ctx))
            .call(tableau_dots(ctx))
        ;
    }

    function _notes_data(ctx, opt) {
        opt = $.extend({
            player:null,
            playerData:null,
            day: null
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
        if( !opt.day) {
            return data;
        }
        if(typeof(opt.day.id) == "number")  {
            return data.filter(function(d){
                return d._tableau_.day == opt.day.id;});
        }
        var days = {};
        opt.day.forEach(function(d){
            days[d.id] = d;
        });
        data = data.filter(function(d){
            var day = days[d._tableau_.day];
            if( !day ) {
                return false;
            }
            d._tableau_._day_ = day;
            return true;
        });
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
        if( d._tableau_._day_ ) {
            day = d._tableau_._day_.order;
        }
        //TODO, depends on the projection axis
        return ctx.scaley(day)
            + ctx.rowHeight - ctx.scalenotes(d.note);
    }


    function playerNotesStack(ctx, player) {
        ctx._stacks = ctx._stacks || {};
        if( !ctx._stacks[player.uid]) {
            ctx._stacks[player.uid] = _build_notes_stack(ctx, player.uid);
        }
        return ctx._stacks[player.uid];
    }



    function _build_notes_stack(ctx, uid) {
        var player = playerByUID(ctx, uid),
            stack = [], i,
            notes = player.player.notes, note,
            scalenotes = ctx.scalenotes,
            tot = 0, ty, count = 0, days = null;
        if( !ctx.svg.select('.days').empty()) {
            days = {};
            ctx
                .svg
                .select('.days')
                .selectAll('.day[opacity="1"]')
                .data()
                .forEach(function(d){
                    days[d.id] = true;
                });
        }
        for( i = 0; i < notes.length; ++i ) {
            if( days ) {
                if( !(i in days)) {
                    continue;
                }
            }
            note = notes[i].note;
            if( note ) {
                tot += scalenotes(note);
            }
        }
        ty = ctx.scaley(ctx.rowCount) - tot;
        for( i = 0; i < notes.length; ++i) {
            if( i && (note = notes[i-1].note)){
                if( !days || (i in days) ) {
                    ty += scalenotes(note);
                    count += 1;
                }
            }
            stack[i] = {
                ty:ty,
                count: count
            };
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

    //generate the data for days
    function tableau_daysData(ctx, range) {
        var i, rows = [], order = 0;
        for(i = 0; i < ctx.data.playersAll[0].notes.length; ++i) {
            if( range && (i < range[0] || i > range[1])) {
                    continue;
            }
            rows.push({
                title: "J" + d3.format("02")(i+1),
                id: i,
                order: order++
            });
        }
        
        return rows;
    }
    
    function tableau_rowHeaders(ctx, svg) {
        svg.append('g')
            .attr('class', 'rowHeaders')
            .call(tableau_days(ctx))
            .selectAll('.day')
            .append('text')
            .attr('class', 'rowTitle')
            .text(function(d){
                return d.title;
            });
    }


    //return a generator for days
    function tableau_days(ctx) {
        var days;
        return function(selection, range) {
            days = selection
                .selectAll('.day')
                .data(tableau_daysData(ctx, range), function(d){
                    return d.id;});
            days.enter()
                .append('g')
                .attr('class', 'day')
                .merge(days)
                .attr('transform', function(d){
                    return 'translate(0, '
                        + ctx.scaley(d.order+1) + ')';
                })
                .attr('opacity', 1);
            days.exit()
                .attr('opacity', 0);
            // selection.select('.day')
            //     .call(tableau_playerSelected(ctx));
        };
    }

    //format id to string suitable for use as html attribute id
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
