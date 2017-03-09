$(function(){

    $.ajaxSetup({
        headers:{"X-CSRFToken": Cookies.get('csrftoken')}
    });
    
    var url = window.pomcodata,
        players = [],
        $playserSelect = $('.players-select'),
        $playersList = $('.js-players-list'),
        currentTeam = null;

    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        success: function(datacsv) {
            var data = parseCSV(datacsv);
            players = data.players;
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

//    $('js-search-teams').
    
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
                value = player.nom + '('+player.team+')',
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
    })

    //parse the csv file
    function parseCSV(data){

        var players = [],
            teams = [],
            lines = data.split("\n"),
            current_team = "";

        //extract teams
        var reg = new RegExp("-{8}\s\d+\s-\s(\D+)$([^,]+)", "m");
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
            
            if( ! (new RegExp("^[GDMA],")).test(line)) continue;
            
            var split = line.split(",");
            
            var player = {
                poste: split[0],
                nom: split[1],
                tit: split[2],
                entrees: split[3],
                buts: split[4],
                team: current_team
            };
            players.push(player);
        }

        return {players:players, teams:teams}
    }

    
});

