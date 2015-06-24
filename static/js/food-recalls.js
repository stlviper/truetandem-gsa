function RecallingFirmStatsModal(firm){
	var me = this;
	var apiUrl = 'https://api.fda.gov/food/enforcement.json';
	var modalTemplate = Hogan.compile($('#modal_template').html(), {
		delimiters: '<% %>'
	});
    var $modal = null;
    
    this.show = function(){
    	this.getRecallStatistics().then(function(data){
    		console.log(data.recallCountsByState);
	        $('#modal_container').html(modalTemplate.render({
	            firm: firm,
	            totalRecalls: data.totalRecalls,
	            recallCountsByState: data.recallCountsByState,
	            recallCountsByYear: data.recallCountsByYear
	        }));        	        	
            me.prepareBarChart(data.recallCountsByYear);
	        $modal = $('#modal').modal();    		
    	});
    }

    this.prepareBarChart = function(data){
		var margin = {top: 20, right: 20, bottom: 30, left: 40},
		    width = 300 - margin.left - margin.right,
		    height = 300 - margin.top - margin.bottom;

		var x = d3.scale.ordinal()
		    .rangeRoundBands([0, width], .1);

		var y = d3.scale.linear()
		    .range([height, 0]);

		var xAxis = d3.svg.axis()
		    .scale(x)
		    .orient("bottom");

		var yAxis = d3.svg.axis()
		    .scale(y)
		    .orient("left")
		    .ticks(10);

		var svg = d3.select(".chart")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		    .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		x.domain(data.map(function(d) { return d.year; }));
		y.domain([0, d3.max(data, function(d) { return d.count; })]);

		  svg.append("g")
		      .attr("class", "x axis")
		      .attr("transform", "translate(0," + height + ")")
		      .call(xAxis);

		  svg.append("g")
		      .attr("class", "y axis")
		      .call(yAxis)
		    .append("text")
		      .attr("transform", "rotate(-90)")
		      .attr("y", 6)
		      .attr("dy", ".71em")
		      .style("text-anchor", "end")
		      .text("Recalls");

			var barColorAlternator = true;
			svg.selectAll(".bar")
				.data(data)
				.enter().append("rect")
				.attr("class", function(){
					barColorAlternator = !barColorAlternator;
					return barColorAlternator ? 'bar' : 'bar2';
				})
				.attr("x", function(d) { return x(d.year); })
				.attr("width", x.rangeBand())
				.attr("y", function(d) { return y(d.count); })
				.attr("height", function(d) { return height - y(d.count); });		    

    }

    this.getRecallStatistics = function(){
    	var deferred = $.Deferred();

    	this.getRecallDates().then(function(recallDatesResponse){
    		var recallCountsByYear = me.getRecallCountsByYear(recallDatesResponse.results);
    		var totalRecalls = 0;
    		for(var x = 0; x <recallCountsByYear.length; x++){
    			totalRecalls += recallCountsByYear[x].count;
    		}
    		me.getRecallCountsByState().then(function(recallCountsByStateResponse){
    			deferred.resolve({
    				totalRecalls: totalRecalls,
    				recallCountsByState: recallCountsByStateResponse.results,
    				recallCountsByYear: me.getRecallCountsByYear(recallDatesResponse.results)
    			});
    		});
    	});

    	return deferred;
    }

    /**
      * Extracts recall counts and groups them by year.
     **/
    this.getRecallCountsByYear = function(recalls){
        var counts = {};
        for(var x = 0; x < recalls.length; x++){        	
        	var recallPoint = recalls[x];
        	console.log(recallPoint);
        	var dateStr = recallPoint.time;
        	var recallYear = dateStr.substr(0,4);
        	if(!counts[recallYear]){
        		counts[recallYear] = recallPoint.count;
        	} else {
        		counts[recallYear] += recallPoint.count;
        	}        	
        }

        var recalls = [];
        for(var key in counts){
        	recalls.push({
        		year: key,
        		count: counts[key]
        	});
        }
        return recalls;
    }

    this.getRecallCountsByState = function(){
        return $.getJSON(apiUrl +'?search=recalling_firm:"'+firm.replace(/[^\w\s]/gi, '')+'"&count=state.exact', {}, function(response){
        	return response.results;
        })
    }

    this.getRecallDates = function(){
        return $.getJSON(apiUrl + '?search=recalling_firm:"'+firm.replace(/[^\w\s]/gi, '')+'"&count=report_date', {}, function(response){
        	return response.results;
        });
    }
}

/**
  * Handles google map operations.
  *
  **/
function Geospatial(mapDivId){
	var map;
	var geocoder = new google.maps.Geocoder();
	// Stores all markers that are added
	var markers = []; 

	// Initializes the google map
	this.initialize = function(){
		map = new google.maps.Map(document.getElementById(mapDivId), {
			zoom: 8,
			draggable: false, 
			zoomControl: false, 
			scrollwheel: false,
			mapTypeId: google.maps.MapTypeId.ROADMAP			
		});
	}

	/**
	  * Geocodes a plain address string. Returns a promise that is evaluated
	  * when the geocoder finishes processing the request.
	 **/
	this.geocode = function(location){
		var deferred = $.Deferred();
		geocoder.geocode( { 'address': location}, function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {			
				deferred.resolve(results[0]);
			} else {
				alert('Geocode was not successful for the following reason: ' + status);
			}
		});
		return deferred.promise();
	}

	/**
	  * Adds a point on the map. 
	 **/
	this.addMarker = function(geocodedResult){
		this.clearMarkers();
		var location = geocodedResult.geometry.location;

		var marker = new google.maps.Marker({
			map:map,
			position: location
		});
		map.setCenter(location);
		markers.push(marker);
	}

	/**
	  * Iterates through all markers in the array, sets the map to null in order to
	  * remove it from the actual map and then deletes it from the array
	  **/
	this.clearMarkers = function(){
		while(markers.length > 0){
			var marker = markers.pop();
			marker.setMap(null);
		}
	}

	this.getMap = function(){
		return map;
	}

	// Checks if map is loaded and instantiated
	this.mapLoaded = function(){
		return !(map == null);
	}
}

function FoodRecalls(gridEl){	
	var $table = $(gridEl);	// Reference to raw table element
	var $grid = null; // Stores the DataTable() object
	var $detailsSection = $('#details_section');
	var foodRecalls = [];
	var me = this;
	var geospatial = new Geospatial('map-canvas');
	var foodRecallApiUrl = 'https://api.fda.gov/food/enforcement.json';

	var detailsTemplate = Hogan.compile($('#details_template').html(), {
		delimiters: '<% %>'
	});

	this.initialize = function(gridEl){
		this.createGrid(gridEl);
		this.configureHandlers();	
	}

	this.createGrid = function(){		
		$grid = $table.DataTable({
			"serverSide": true,		
			searching: false,	
			iDisplayLength: 25,
			autoWidth: true,
			fnServerData: this.processServerDataResponse,
			"columns" : [
				{data : 'recall_number'},
				{data : 'recalling_firm'},
				{data : 'state'}
			]
		});
	}

	this.onRowClick = function(event){
		var data = $grid.row(this).data();
		$table.find('tr').removeClass('info');
		$(this).addClass('info');
		me.renderDetails(data);
	}

	// Configures handlers for the table
	this.configureHandlers = function(){
		$table.on('click', 'tr', this.onRowClick);
		$detailsSection.on('click', '.recalling-firm', this.showRecallingFirm);
	}
	
	this.showRecallingFirm = function(){
        var data = $(this).data('recallingFirm');
        new RecallingFirmStatsModal(data).show();
	}

	// Renders the data for a specific food recall and renders it to a template
	this.renderDetails = function(data){		
		$detailsSection.html(detailsTemplate.render(data));
		if(!geospatial.mapLoaded()){
			geospatial.initialize();
		}
		var location = data.city + ' ' + data.state;
		geospatial.geocode(location).then(function(marker){			
			geospatial.addMarker(marker);
		});		
	}

	/**
	  * Handles requests when the grid is updated. The FDA API takes in different
	  * parameters from what DataTables is expecting so we manually set them
	  * here. This allows the 'Showing {x} to {y} of {x}' information to be
	  * properly displayed.
	  **/
	this.processServerDataResponse = function(source, data, callback){		
		var start = data[3].value;
		var limit = data[4].value;
		var params = {
			skip: start,
			limit: limit
		};			
		$.getJSON(foodRecallApiUrl, params, function(response){
			response.draw  = data[0].value;
			response.recordsTotal = response.meta.results.total;
			response.recordsFiltered = response.meta.results.total;
			response.data = response.results;
			callback(response)
			foodRecalls = response.results;

			if(foodRecalls && foodRecalls.length > 0){
				me.renderDetails(foodRecalls[0]);
			}
		});		
	}

	this.initialize();
}


var recalls = new FoodRecalls('#grid');