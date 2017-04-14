(function(){

    //EXPORTS
    window.tableau = {
        init:init,
        members: getMembers,
        remove:remove_member,
        complement:complement,
        moves:moves,
        groupByPoste:groupByPoste,
        trim:_trim
    };

    var
        d3 = window.d3;

    var NDAYS = 38,
        titleWidth = 100,
        GROUPS = [
            {
                filter:'G',
                title:'Goalkeeper'
            }
            ,{
                filter:'D',
                title: "Defenders"
            }, {
                filter:'M',
                title: "Middfields"
            }, {
                filter:'A',
                title:"Forwards"
            }];

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
        ctx.width = opt.width || 380;
        ctx.rowHeight = 50;
        ctx.colWidth = 10;
        ctx.playersInfo = {};
        ctx.trimData = true;
        ctx.rowCount = NDAYS;
        ctx.data = opt.data;
        ctx.colCount = ctx.data.playersAll.length;
        ctx.width = ctx.colCount * ctx.colWidth;
        ctx.rowHeaderWidth = 30;
        ctx.colHeaderHeight = 50;
        ctx.scalex =  d3.scaleLinear()
	    .domain([0, ctx.colCount])
	    .range([ctx.rowHeaderWidth, ctx.width]);
    }

    function tableau_height(ctx) {
        return ctx.rowCount * ctx.rowHeight + ctx.colHeaderHeight;
    }


    function _trim(el, opt) {
        var ctx = context(el),
            svg = ctx.svg,
            j, i, player, keep,
            players = ctx.data.playersAll;
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            keep = false;
            for( j = 0; j < player.notes.length; ++j ) {
                if( player.notes.note[j] ) {
                    keep = true;
                    break;
                }
            }
            ctx.playersInfo[player.uid].order = -1;
        }
        //fix ordering
        players = players.slice().sort(function(p1, p2){
            return tableau_player_order(p1) - tableau_player_order(p1);
        });
        for( i = 0; i < players.length; ++i ) {
            player = players[i];
            ctx.playersInfo[player.uid].order = i;
        }
        //redraw
        svg
            .selectAll('.note');
    }

    function tableau_player_order(ctx, uid) {
        return ctx.playersInfo[uid].order;
    }

    
    function init(el, opt){
        var ctx = context(el),
            svg, i, j, player,
            days = [], data = [];
        update_context(el, opt);
        svg = d3.select(el).select('svg');
        //init players info
        for( i =0 ; i < ctx.data.playersAll.length; ++i) {
            player = ctx.data.playersAll[i];
            ctx.playersInfo[player.uid] = {
                order:i
            };
        }
        ctx.rowCount = ctx.data.playersAll[0].notes.length;
        svg = d3
            .select(el)
            .append('svg')
            .attr('width', ctx.width)
            .attr('height', tableau_height(ctx));
        //save svg ref to ctx for future reuse
        ctx.svg = svg;
        for( i = 0; i < ctx.data.playersAll.length; ++i) {
            player = ctx.data.playersAll[i];
            var count = ctx.rowCount;
            for( j = 0; j < count; ++j) {
                var d = player.notes[j];
                d._tableau_ = {
                    player: player.uid,
                    day: j
                };
                data.push( d );
            }
        }
        //TODO: moves var to begin
        var scalex = ctx.scalex;
        //TODO: moves to context init
        ctx.scaley = d3.scaleLinear()
                .domain([0, ctx.rowCount])
                .range([ctx.colHeaderHeight,
                        tableau_height(ctx)]);
        var scaley = ctx.scaley;
        var scalenotes = d3.scaleLinear()
	    .domain([0, 9])
	    .range([ctx.rowHeight, 2]);
        svg
            .append('g')
            .selectAll('.note')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'note')
            .attr('transform', function(d){
                var tx = tableau_player_tx(ctx, d._tableau_.player),
                    ty = scaley(d._tableau_.day) + ctx.rowHeight - scalenotes(d.note);
                return 'translate(' + tx + ','
                    +  ty + ')';
            })
            .attr('width', ctx.colWidth - 1)
            .attr('height', function(d) {
                if( !d.note ) return 0;
                return scalenotes(d.note);
            });
        tableau_rowHeaders(ctx);
        tableau_colHeaders(ctx);
    }

    function tableau_selection_notes(ctx) {
        
        return function(selection){
            
        };
    }
    
    function tableau_player_tx(ctx, uid) {
        return ctx.scalex(ctx.playersInfo[uid].order);
    }

    function tableau_colHeaders(ctx) {
        var svg = ctx.svg,
            columns = [], i,
            players = ctx.data.playersAll,
            player;
        for(i = 0; i < players.length; ++i) {
            player = players[i];
            columns.push({
                title: player.nom,
                player: player.uid,
                order: ctx.playersInfo[player.uid].order
            });
        }
        svg.selectAll('.colTitle')
            .data(columns)
            .enter()
            .append('text')
            .attr('class', 'colTitle')
            .text(function(d, i){ return d.title;})
            .attr('transform', function(d){
                var tx = tableau_player_tx(ctx,d.player);
                return 'translate(' + tx + ',' + ctx.colHeaderHeight + ') rotate(-45)';
            })
        ;
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
        svg.selectAll('.rowTitle')
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
        
    
    //tableau
    function drawAggregate(el, opt){
        var members = opt.members,
            detail = opt.detail,
            w = opt.width || 380,
            h = opt.height || 120,
            $el = $(el);
        report_cards = report_card(members, {
            detail:detail,
            filterClub: opt.filterClub,
            filterPoste: opt.filterPoste,
            filterName: opt.filterName,
            excludeMembers:opt.excludeMembers
        });
        $el.data("tableau-options", {
            members:members,
            cardHeight:h,
            cardWidth:w,
            detail:detail
        });
        svg = d3.select(el).select('svg');
        if( !svg.size() ) {
            svg = d3.select(el)
                .append('svg');
        }
        svg.attr("width", w);

        draw_season(el, report_cards);
    }


    function scaleX(el) {
        return d3.scaleLinear()
	    .domain([0, NDAYS])
	    .range([0, notesWidth(el)]);
    }


    function yscale(el) {
        var h = options(el, "cardHeight");
        return d3.scaleLinear()
	    .domain([0, 9])
	    .range([h, 2]);
    }
    
    function draw_entered(el) {
        var h = options(el, "cardHeight"),
            x = scaleX(el),
            y = yscale(el),
            w = options(el, "cardWidth");

        function _bars(bars, offset) {
            bars                
                .attr("transform", function(d, i){
                    var y = 0;
                    if( offset )
                        y = d.offset;
                    return "translate("+x(i)+"," + y + ")";
                })
                .merge(bars)
                .attr("height",  function(d){
                    var val = _val( d);
                    return h - y(val);
                })
                .attr("y", function(d){
                    var val = _val(d);
                    return y(val);
                    
                })
                .attr("width", x(1) - 2);
            function _val(d) {
                if( !offset) {
                    return d.n;
                }
                return d.ncoef;
            }
        }
        
        return {
            entered: function (records) {
                var arrow = records.selectAll("text.entered")
                        .data(function(report){
//                            return get_notes(report.definition);
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
                    .text(function(t){if(t) return "<"; return "";});
            },
            bars:_bars,
            notes: function(records, offset){
                var bars = records
                        .selectAll("rect")
                        .data(function(card){
                            var offsets = function(i){
                                return -card.offsets[i];
                            };
                            if( !card.offsets ) {
                                offsets = function(i){return 0;};
                            }
                            return card.notes.map(function(n, i) {
                                if( isNaN(n) ) n=0;
                                return {
                                    n:n,
                                    offset:offsets(i),
                                    ncoef: n * (card.coef || 1)
                                };
                            });
                        });
                bars = bars
                    .enter()
                    .append("rect")
                    .attr("class", "day")
                    .merge(bars)
                ;
                _bars(bars, offset);
                return;
                bars
                    .enter()
                    .append("rect")
                    .attr("class", "day")
                    .attr("transform", function(d, i){
                        return "translate("+x(i)+"," + d.offset + ")";
                    })
                    .merge(bars)
                    .attr("height",  function(d){
                        var val = d.n;
                        return h - y(val);
                    })
                    .attr("y", function(d){return y(d.n);})
                    .attr("width", x(1) - 2);
            },
            axis: function(season){
                var yAxis = d3.axisRight()
                        .scale(y)
                        .tickSize(-notesWidth(el))
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
        };
    }

    function notesWidth(el) {
        return options(el, 'cardWidth') - titleWidth;
    }
    
    
    function complement(el, val) {
        var members = getMembers(el),//options(el, 'members'),
            svg = selectSVG(el),
            data = report_card(members, { excludeMembers: val, detail: true});
        draw_season(el, data);
    }


    function set_tableau_height(el, report_cards) {
        var h = options(el, "cardHeight");
        selectSVG(el)
            .attr("height", h * report_cards.length + 2);
    }

    //internal of  d3_draw_season
    function draw_season(el, report_cards, opt){
        opt = opt || {};
        var svg = selectSVG(el),
            click = opt.click || null,
            h = options(el, "cardHeight"),
            w = options(el, "cardWidth"),
            season = svg.selectAll('g.season')
                .data(report_cards),
            draw = draw_entered(el),
            tr = transform(el);
        //to be changed with set_tableau_height(el, report_cards)
        season
        //            .transition(transition)
            .call(tr);
        svg
            .transition(transition)
            .attr("height", h * report_cards.length + 2);
        season
        //ENTER
            .enter()
            .append('g')
            .attr('class', 'season')
            .call(setSize(el))
            .call(tr)
            .call(function(enter){
                enter
                    .append("g")
                    .attr('class', 'records')
                    .attr('transform', "translate(" + titleWidth + ",0)")
                    .merge(season.select('g.records'));
                enter
                    .append("g")
                    .style("text-anchor", "end")
                    .attr("transform", "translate("
                          + (titleWidth - 6) + ", "
                          + h / 2 + ")")
                    .call(function(thumbnail){
                        thumbnail
                            .append("text")
                            .attr('class', 'title');
                        thumbnail
                            .append("text")
                            .attr('class', 'club')
                            .attr('y', 15);
                    });
                enter
                    .call(draw.axis)
                    .append('rect')
                    .attr('class', 'season-glass')
                    .call(setSize(el))
                    .attr('opacity', 0);
            })
        //UPDATE
            .merge(season)
            .attr('id', function(d){return uid_to_id(d.id);})
            .attr("opacity", 1)
            .attr('display', true)
            .each(function(d){d._hidden=false;})
            .call(function(season){
                season
                    .select('g.records')
                    .call(draw.entered)
                    .call(draw.notes);
                season.select('text.title')
                    .text(function(s){return s.name;});
                season
                    .select('text.club')
                    .text(subtitle);
            });
        season.exit()
            .attr('id', "")
            .attr("opacity", 0)
            .attr("display", 'none')
            .each(function(d){
                d._hidden = true;
            });
    }

    function subtitle(s) {
        if (s.name == "Team" || s.id == "$team" ||
            typeof(s.id) == "number") {
            return "";
        }
        p = statsmpg.players[s.id];
        if( !p ) {
            return "";
        }
        return p.team + " - " + p.poste;
    }
    
    function _complement(members) {
        var newMembers = [];
        for( var i = 0; i < members.length; ++i) {
            if( typeof(members[i])!= 'string') {
                newMembers.push(members[i]);
            }
        }
        for( var key in statsmpg.players){
            if( members.indexOf(key) == - 1) {
                newMembers.push(key);
            }
        }
        return newMembers;
    }

    function expand_members(members) {
        if( members.indexOf('*') > -1 ) {
            return statsmpg.playersAll.map(statsmpg.playerUID);
        }
        return members;
    }

    function filter_members(members, opt) {
        var filterPoste = opt.filterPoste || false,
            filterClub = opt.filterClub || false,
            filterName = opt.filterName || false;
        if( filterPoste ) {
            members = members.filter(function(m){
                if(typeof(m) != 'string') {
                    return true;
                }
                return statsmpg.players[m].poste == filterPoste;
            });
        }
        if( filterClub ) {
            members = members.filter(function(m){
                if(typeof(m) != 'string') {
                    return true;
                }
                return statsmpg.players[m].team == filterClub;
            });
        }
        if( filterName ) {
            var search = filterName.toLowerCase();
            members = members.filter(function(m){
                if(typeof(m) != 'string') {
                    return true;
                }
                return statsmpg.players[m].nom.toLowerCase().indexOf(search) > -1;
            });
        }
        return members;
    }

    function process_members(members, opt) {
        var opt = opt || {},
            exclude = opt.excludeMembers || false;
        if(! members ) {
            return [];
        }
        if( typeof(members) == 'string' ) {
            members = [members];
        }
        if( Array.isArray(members) ) {
            members = members.slice();
        } 
        for( var i = 0; i < members.length; ++i ) {
            var m = members[i];
            if( Array.isArray(m)) {
                members[i] = process_members(m, opt);
            }
            else if( Array.isArray(m.members)) {
                var newm = {};
                for( var k in m ) {
                    newm[k] = m[k];
                }
                newm.members = process_members(m.members, opt);
                members[i] = newm;
            }
        }
        if( exclude ) {
            var newMembers = _complement(members);
            members = newMembers;
        }
        members = expand_members(members);
        members = filter_members(members, opt);
        return members;
    }
    
    function report_card(members, opt){
        opt = opt || {};
        var detail = opt.detail || false,
            exclude = opt.excludeMembers || false,
            reports = [];
        members = process_members(members, opt);
        Array.prototype.push.apply(
            reports,
            members.map(function(m, index){
                var id;
                if( typeof(m) == 'string') {
                    //TODO: replace id by its position index in the list
                    id = get_id(m);
                } else {
                    if( m.id != null) {
                        id = "" + m.id;
                    } else {
                        id = "" + index;
                    }
                }
                return {
                    name:get_name(m),
                    notes:get_notes(m),
                    id:id,
                    definition:m,
                    count:get_count(m)
                };
            }));
        return reports;
    }


    function get_count(members){
        if( typeof(members) == 'string') {
            return 1;
        };
        if( members.members) {
            return members.members.length;
        }
        return members.length;
    }
    
    function getMeansNoteByDay(members){
        if( members.members ) {
            members = members.members;
        }
        return statsmpg.meansByDay(members);
    }

    function get_id(member) {
        if( typeof(member) == 'string') {
            return member;
        }
        if( member.name ) {
            return member.name;
        }
        return "$team";
    }
    

    function get_name(member){
        if( typeof(member) == 'string') {
            return statsmpg.players[member].nom;
        }
        if( member.name ) {
            return member.name;
        }
        if( member.team_name) {
            return member.team_name;
        }
        return "";
    }


    function get_notes(member){
        var notes = _get_notes(member);
        for( var i = 0; i < notes.length; ++i) {
            if( isNaN(notes[i])){
                notes[i] = 0;
            }
        }
        return notes;
    }

    function _get_notes(member){
        if( typeof(member) == 'string') {
            var player = statsmpg.players[member];
            return player.notes.map(function(note){
                if( isNaN(note.note)) {
                    return 0;
                }
                return note.note;
            });
        }
        return getMeansNoteByDay(member);
    }

    //get the members displayed
    function getMembers(el) {
        el = el || $('.js-team-aggregate')[0];
        var data = d3.select(el).selectAll('.season')
                .data()
                .filter(function(d){
                    return !d._hidden;
                });
        if( !data.length ) {
            return [];
        }
        if( data[0]._order != null) {
            sortCards(data);
        }
        return data
            .map(function(d) {
                if( d.definition ) {
                    return d.definition;
                }
                return d.id;
                
            })
            .filter(function(m){return m;})
        ;
    }

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


    function sortCards(cards){
        cards.sort(function(d1, d2){
            return d1._order - d2._order;
        });            
    }

    function selectSVG(el) {
        el = el.jquery ? el[0]:el;
        return d3.select(el).select('svg');
    }

    var foo = function(){
        function bar(){}
    };
    
    function groupByPoste(el, enable) {
        var $el = $(el),i,
            svg = selectSVG(el),
            cardHeight = options(el, 'cardHeight')
        ;
        if( !enable ) {
            members = $el.data('_tableau_members');
            svg
                .transition(transition)
                .selectAll('.season')
                .attr('transform', function(d){
                    return "translate(0, " + d.group[0] * cardHeight + ")";
                })
                .on('end', function(){
                    draw_season(el, report_card(members));
                })
            ;
            return;
        }
        var members = getMembers(el);
        $el.data('_tableau_members', members);
        var cards = [],
            draw = draw_entered(el);
        cards = [];
        //for now we only support groups of the same length
        $(el).data('tableau-options').grouplength = 5;
        for( i = 0; i < members.length; ++i ) {
            g = groupscards(members[i], i);
            cards = cards.concat(g);
        }
        draw_season(el, cards);
        svg.selectAll('g.season')
            .attr('transform', function(d){
                var y = d.group[0] * cardHeight;
                return "translate(0, " + y + ")";
            })
            .call(function(season){
                season
                    .selectAll('text.title')
                    .text(function(d){
                        if(d.group[1]) {
                            return "";
                        }
                        return d.name;
                    });
                season
                    .selectAll('text.club')
                    .text(function(d){
                        if( d.group[1]) {
                            return d.filterposte;
                        }
                        return subtitle(d);
                    });
                season.selectAll('.records')
                    .call(draw.notes, true);
            })        
            .transition(transition)
            .attr('transform', function(d){
                var y =  (d.group[0] * 5 + d.group[1]) * cardHeight;
                return "translate(0, " + y + ")";
            })
            .call(function(season){
                season.selectAll('.records')
                    .selectAll("rect")
                    .call(draw.bars, false);
            })
        ;
        function groupscards(members, index){
            var cards = report_card([members]),
                notes = null,
                i, j
            ;
            for( i = 0; i < GROUPS.length; ++i){
                var g = GROUPS[i],
                    poste = g.filter,
                    c = report_card([members], {
                        filterPoste:poste
                    }),
                    card = c[0],
                    coef = card.count / cards[0].count
                ;
                card.id += "_" + poste;
                card.filterposte = poste;
                card.coef = coef;
                if( !notes ) {
                    notes = Array(card.notes.length).fill(0);
                }
                card.offsets = notes;
                notes = [];
                for( j = 0; j < card.notes.length; ++j ) {
                    var n = card.notes[j];
                    if( n == "<"){
                        n = 0;
                    }
                    notes.push(card.offsets[j] + card.notes[j] * coef);
                }
                cards = cards.concat(c);
            }
            for( i = 0;i < cards.length; ++i ) {
                cards[i].group = [index, i];
            }
            return cards;
        }
    }


    function contributions() {
    }
    
    function cardHeight(el){
        return options(el, 'cardHeight');
    }

    function moves(el, m1, m2) {
        var svg = d3.select(el)
                .select('svg'),
            tr2 = selectMember(el, m2)
                .attr('transform'),
            data = svg.selectAll('g.season').data();
        selectMember(el, m1)
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
        svg.selectAll('g.season')
            .each(function(d, i, nodes){
                newindex = d._order;
                transform(el)(d3.select(this)
                              .transition(transition), newindex);
            });
    }

    
    function remove_member(el, member) {
        var svg = selectSVG(el);
        svg.select("#" + uid_to_id(member))
            .remove();
        var data = svg.selectAll('.season').data();
        if( !data.length ) {
            return;
        }
        if( data[0]._order == null) {
            initCardOrder(data);
        }
        sortCards(data);
        //find members position
        initCardOrder(data);
        svg
            .selectAll('g.season')
            .transition(transition)
            .call(transform(el));
    }


    function options(el, prop) {
        var $el = (el.jquery) ? el : $(el),
            opts =  $el.data('tableau-options');
        return opts[prop];
    }
    
    function transform(el){
        var h = options(el, 'cardHeight'),
            grouplength = options(el, 'grouplength');
        return function(sel, i){
            var y = function(index){
                return index * h;
            };
            if( i != null) {
                y = function(){
                    return i * h;
                };
            };
            return sel.attr('transform', function(d, i) {
                var ii = i;
                if( d.group != null && grouplength ) {
                    
                    return "translate(0, " + (d.group[0] * grouplength + d.group[1]) * h  + ")";
                }
                if( d._order != null) {
                    ii = d._order;
                }
                return "translate(0, " + y(ii) + ")";
            });
        };
    }
    
    function selectMember(el, m) {
        var svg = selectSVG(el);
        return svg.select("#" + uid_to_id(m));
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

    function setSize(el) {
        var h = options(el, "cardHeight"),
            w = options(el, "cardWidth");
        return function(sel){
            sel.attr('width', w)
                .attr('height', h);
            return sel;
            
        };
    }
})()
