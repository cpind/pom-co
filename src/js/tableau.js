(function(){
    
    function init(el, members, opt){
        opt.members = members;
        return drawAggregate(el, opt);
    }

    function switchMembers(m1, m2) {
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
                filterPoste = opt.filterPoste,
                filterClub = opt.filterClub,
                excludeMembers = opt.excludeMembers;
                svg = d3.select('svg'),
            reportCards = report_card(members, opt);
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

    function sortCards(cards){
        cards.sort(function(d1, d2){
            return d1._order - d2._order;
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
    function members(el) {
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

    //EXPORTS
    window.tableau = {
        init:init,
        sortCards: sortCards,
        members: members
    };

})()
