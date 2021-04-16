//checks if the api token has expired
function isApiTokenValid() {
    var now = new Date();
    var expires_at = localStorage.getItem('api_token_expires_at');
    return (new Date(now) > new Date(expires_at)) ? false : true;
}

//gets api access token
function getApiToken() {
    var payload = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'transportapi:all'
    };
    var request = new XMLHttpRequest();
    return new Promise(function (resolve, reject) {
        request.open('POST', TOKEN_ENDPOINT, true);
        request.addEventListener('load', function () {
            if (request.readyState == 4) {
                if (request.status >= 300) {
                    reject("Api Error | status code: " + xhr.status)
                }
                else {
                    var response = JSON.parse(this.responseText);
                    var expires_at = new Date();
                    expires_at.setMinutes(expires_at.getMinutes() + 30);
                    localStorage.setItem('api_token', response.access_token);
                    localStorage.setItem('api_token_expires_at', expires_at);
                    resolve(request.responseText);
                }
            }
        });
        request.setRequestHeader('Accept', 'application/json');
        var formData = new FormData();

        for (var key in payload) {
            formData.append(key, payload[key]);
        }
        request.send(formData);
    });
}

//gets journey/trip information based on token validity
function getJourney() {
    if (isApiTokenValid()) {
        getApiJourney();
    }
    else {
        getApiToken().then(function () {
            getApiJourney();
        }, function () {
            details.innerHTML = "Your journey could not be retrieved. Please try again."
        });
    }
}

//retrieves journey from the api
function getApiJourney() {
    var body = {
        geometry: {
            type: 'Multipoint',
            coordinates: [[trip.origin.lng, trip.origin.lat], [trip.destination.lng, trip.destination.lat]],
        }
    };
    var request = new XMLHttpRequest();
    request.addEventListener('load', function () {
        if (request.readyState == 4) {
            if (request.status >= 300) {
                details.innerHTML = "Your journey could not be retrieved. Please try again."
            }
            else {
                journey.removeAttribute('hidden');
                UIkit.scroll().scrollTo(journey);
                var response = JSON.parse(this.responseText);
                if (response.itineraries[0] != undefined) {
                    details.innerHTML = '';
                    populateJourneyInfo(response.itineraries[0]);
                    document.getElementById('btnViewDirections').removeAttribute('hidden');
                }
                else {
                    document.getElementById('btnViewDirections').setAttribute('hidden', '');
                    details.innerHTML = "Your journey doesn't have any additional information. Try another combination."
                }
            }
        }
    });
    request.open('POST', JOURNEY_ENDPOINT, true);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('api_token'));
    request.send(JSON.stringify(body));
}

//formats dates received from the api
function formatDateTime(date) {
    var formattedDate;
    if (date.substring(date.length - 1) == "Z") {
        date = date.substring(0, date.length - 1);
    }

    try {
        formattedDate = date.split("T").join(" ");
        formattedDate = new Date(formattedDate);
        formattedDate = new Date(formattedDate.setHours(formattedDate.getHours() + 2));
    } catch (err) {
        formattedDate = "unknown";
    }
    return formattedDate;
}

//helper to create li nodes
function createListItem(item) {
    var li = document.createElement('li');
    li.textContent = item;
    return li;
}

//form validation
function validForm() {
    var valid = false;
    if (origin.value.length > 0) {
        valid = true;
        origin.classList.remove('uk-form-danger');
    }
    else {
        valid = false;
        origin.classList.add('uk-form-danger');
    }

    if (destination.value.length > 0) {
        valid = true;
        destination.classList.remove('uk-form-danger');
    }
    else {
        valid = false;
        destination.classList.add('uk-form-danger');
    }

    if (trip.origin == undefined || trip.destination == undefined) {
        valid = false;
        document.getElementById('invalidAddress').removeAttribute('hidden');
    }
    else {
        valid = true;
        document.getElementById('invalidAddress').setAttribute('hidden', '');
    }
    return valid;
}

//shows the route on a map using Google Maps
function showRoute() {
    var map;
    var start = new google.maps.LatLng(trip.origin.lat, trip.origin.lng);
    var end = new google.maps.LatLng(trip.destination.lat, trip.destination.lng);
    var option = {
        zoom: 10,
        center: start
    };
    map = new google.maps.Map(document.getElementById('map'), option);
    var display = new google.maps.DirectionsRenderer();
    var services = new google.maps.DirectionsService();
    display.setMap(map);
    var request = {
        origin: start,
        destination: end,
        travelMode: 'DRIVING'
    };
    services.route(request, function (result, status) {
        if (status == 'OK') {
            display.setDirections(result);
        }
    });
}

//displays journey info to the user
function populateJourneyInfo(journey) {
    details.appendChild(createListItem(`Departure Time: ${formatDateTime(journey.departureTime)}`));
    details.appendChild(createListItem(`Arrival Time: ${formatDateTime(journey.arrivalTime)}`));
    details.appendChild(createListItem(`Duration: ${Math.ceil(journey.duration / 60)} minutes`));
    details.appendChild(createListItem(`Distance: ${journey.distance.value}${journey.distance.unit}`));
    details.appendChild(createListItem(`Mode: ${journey.legs[0].type}`));

    var directionItems = journey.legs[0].directions;
    directions.innerHTML = '';
    directionItems.forEach(function (directionItem) {
        directions.appendChild(createListItem(`${directionItem.instruction} for ${directionItem.distance.value}${directionItem.distance.unit}`));
    });
}

//geolocation - autocomplete addresses
function geolocate(addressInput, point) {
    var autocomplete = new google.maps.places.Autocomplete(addressInput);
    autocomplete.setComponentRestrictions({ country: 'za' });
    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        test = autocomplete;
        if (place.geometry == undefined)
            validGeolocation = false; //handle early enter key
        else {
            trip[point] = { 'lat': place.geometry.location.lat(), 'lng': place.geometry.location.lng() };
        }
    });
}