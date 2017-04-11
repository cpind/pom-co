(function(){

    //EXPORTS
    window.tableau = {
        init:init,
        members: getMembers,
        remove:remove_member,
        complement:complement,
        moves:moves
    };

    var NDAYS = 38,
        titleWidth = 100;

    var transition = d3.transition()
        .duration(150)
        .ease(d3.easeLinear);

    function init(el, opt){
        return drawAggregate(el, opt);
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
            filterName: opt.filterName
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
                .append('svg')
        }
        svg.attr("width", w);

        draw_season(el, report_cards);
    }


    function scaleX(el) {
        return d3.scaleLinear()
	    .domain([0, NDAYS])
	    .range([0, notesWidth(el)]);
    }

    function draw_entered(el) {
        var h = options(el, "cardHeight"),
            x = scaleX(el),
            y = d3.scaleLinear()
	    .domain([0, 9])
	    .range([h, 2]),
            w = options(el, "cardWidth");
        return {
            entered: function (records) {
                var arrow = records.selectAll("text.entered")
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
                    .text(function(t){if(t) return "<"; return ""});
            },
            notes: function(records){
                var bars = records.selectAll("rect")
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


    function updateOptions(el, opt){
        var $el = (!el.jquery) ? $(el):el,
            opt = opt || {};
        if( !opt.report_cards ) {
            return;
        }
        var members = opt.report_cards.map(function(c){return c.id;});
        members = members.filter(function (m){return m;})
        $el.data("tableau-options").members = members;
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
    
    //internal of  d3_draw_season
    function draw_season(el, report_cards, opt){
        var svg = selectSVG(el),
            opt = opt || {},
            click = opt.click || null,
            h = options(el, "cardHeight"),
            w = options(el, "cardWidth"),
            season = svg.selectAll('g.season')
            .data(function(){
                return report_cards;})
            .call(transform(el)),
            draw = draw_entered(el);
        updateOptions({report_cards:report_cards});
        svg
            .attr("height", h * report_cards.length + 2);
        season
        //ENTER
            .enter()
            .append('g')
            .attr('class', 'season')
            .call(setSize(el))
            .call(transform(el))
            .call(function(enter){
                enter
                    .append("g")
                    .attr('class', 'records')
                    .attr('transform', "translate(" + titleWidth + ",0)")
                    .merge(season.select('g.records'))
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
            .each(function(d){d._hidden=false;})
            .call(function(season){
                season
                    .select('g.records')
                    .call(draw.entered)
                    .call(draw.notes);
                season.select('text.title')
                    .text(function(s){return s.name;})
                season
                    .select('text.club')
                    .text(function(s){
                        if (s.name == "Team") {
                            return "";
                        }
                        p = statsmpg.players[s.id];
                        
                        return p.team + " - " + p.poste;
                    });
            });
        season.exit()
            .attr('id', "")
            .attr("opacity", 0)
            .each(function(d){
                d._hidden = true;
            });
    }


    function report_card(members, opt){
        var detail = opt.detail || false,
            exclude = opt.excludeMembers || false,
            filterPoste = opt.filterPoste || false,
            filterClub = opt.filterClub || false,
            filterName = opt.filterName || false,
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
            members = statsmpg.playersAll.map(statsmpg.playerUID);
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


    function getMeansNoteByDay(members){
        return statsmpg.meansByDay(members);
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

    //get the members displayed
    function getMembers(el) {
        var data = d3.selectAll('.season')
            .data()
            .filter(function(d){
                return !d._hidden;
            });
        if( data[0]._order != null) {
            sortCards(data);
        }
        return data
            .map(function(d){return d.id;})
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

    
    function switch_members(el, m1, m2){
    }

    function remove_member(el, member) {
        var svg = selectSVG(el);
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
            .call(transform(el));
    }


    function options(el, prop) {
        var $el = (el.jquery) ? el : $(el),
            opts =  $el.data('tableau-options');
        return opts[prop];
    }
    
    function transform(el){
        var h = options(el, 'cardHeight');
        return function(sel, i){
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
        };
    }
    
    function selectMember(el, m) {
        var svg = selectSVG(el);
        return svg.select("#" + uid_to_id(m));
    }


    function uid_to_id(member){
        if( !member ) {return "";}
        var id_tokens = 
            member.split(/[\(\)\ \.]+/);
        id_tokens = id_tokens.filter(function (t){ return t;})
        return id_tokens.join("__");
    }

    function setSize(el) {
        var h = options(el, "cardHeight"),
            w = options(el, "cardWidth");
        return function(sel){
            sel.attr('width', w)
                .attr('height', h);
            return sel;
            
        }
    }
})()
