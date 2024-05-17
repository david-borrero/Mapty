'use strict';

/////////////////////////////////////
//APP architecture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
    #map;
    #mapEvent;
    #activities = [];

    constructor() {
        this._getPosition();

        // Handling form submission
        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        containerWorkouts.addEventListener(
            'click',
            this._moveToMarker.bind(this)
        );

        //Load data from local storage
        this._getLocalStorage();
    }

    _getPosition() {
        // Geolocation API
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                this._loadMap.bind(this),
                function () {
                    alert('Could not get your position');
                }
            );
        }
    }

    _loadMap(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

        const coords = [latitude, longitude];

        this.#map = L.map('map').setView(coords, 15);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(this.#map);

        // Handling clicks on map
        this.#map.on('click', this._showForm.bind(this));

        this.#activities.forEach(work => {
            this._renderMarker(work);
        });
    }

    _hideForm() {
        inputDistance.value =
            inputDuration.value =
            inputCadence.value =
            inputElevation.value =
                '';

        //We put the display to none to hide also the animation
        form.style.display = 'none';
        form.classList.add('hidden');

        setTimeout(() => {
            form.style.display = 'grid';
        }, 1000);
    }

    _showForm(mapE) {
        this.#mapEvent = mapE;
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _toggleElevationField() {
        inputElevation
            .closest('.form__row')
            .classList.toggle('form__row--hidden');
        inputCadence
            .closest('.form__row')
            .classList.toggle('form__row--hidden');
    }

    _newWorkout(e) {
        // Check if data is valid
        const validInputs = (...inputs) =>
            inputs.every(inp => Number.isFinite(inp) && inp > 0);

        e.preventDefault();

        const { lat, lng } = this.#mapEvent.latlng;

        // Get data from form
        const type = inputType.value;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;

        let workout;

        // If workout is running
        if (type === 'running') {
            const cadence = +inputCadence.value;
            if (!validInputs(distance, duration, cadence)) {
                alert('Inputs have to be positive numbers');
                return;
            }

            workout = new Running([lat, lng], distance, duration, cadence);
        }

        // If workout is cycling
        if (type === 'cycling') {
            const elevation = +inputElevation.value;
            if (
                !validInputs(distance, duration) ||
                !Number.isFinite(elevation)
            ) {
                alert('Inputs have to be positive numbers');
                return;
            }

            workout = new Cycling([lat, lng], distance, duration, elevation);
        }

        // Add new object to workout array
        this.#activities.push(workout);

        // Render workout on map as marker
        this._renderMarker(workout);

        // Render workout on list
        this._renderWorkout(workout);

        //hide form
        this._hideForm();

        //Save to local storage
        this._setLocalStorage();
    }

    _renderMarker(workout) {
        L.marker(workout.coords)
            .addTo(this.#map)
            .bindPopup(
                L.popup({
                    maxWidth: 250,
                    minWidth: 100,
                    autoClose: false,
                    closeOnClick: false,
                    className: `${workout.type}-popup`,
                })
            )
            .setPopupContent(
                `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ` +
                    workout.description
            )
            .openPopup();
    }

    _renderWorkout(workout) {
        let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <h2 class="workout__title">${workout.description}</h2>
    <div class="workout__details">
      <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;

        if (workout.type === 'running') {
            html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
        }

        if (workout.type === 'cycling') {
            html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;
        }

        form.insertAdjacentHTML('afterend', html);
    }

    _moveToMarker(e) {
        const workoutEl = e.target.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#activities.find(
            work => work.id === workoutEl.dataset.id
        );

        this.#map.setView(workout.coords, 13, {
            animate: true,
            pan: { duration: 1 },
        });

        // workout.click();
    }

    _setLocalStorage() {
        //JSON.stringify() is to convert an object to a string
        localStorage.setItem('workouts', JSON.stringify(this.#activities));
    }

    //When using the objects from the local storage, the prototypal chain is lost
    //If we wanted it, recreate the objects for each object that comes from the local storage with the data that they give us
    _getLocalStorage() {
        //JSON.parse() is to convert an string to an object
        const data = JSON.parse(localStorage.getItem('workouts'));

        if (!data) return;

        this.#activities = data;

        this.#activities.forEach(work => {
            this._renderWorkout(work);
        });
    }

    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }
}

/////////////////////////////////////
//Workouts

class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);
    // clicks = 0;

    constructor(coords, distance, duration) {
        this.coords = coords; // [lat, lng]
        this.distance = distance; // in km
        this.duration = duration; // in min
    }

    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${
            this.type[0].toUpperCase() + this.type.slice(1)
        } on ${this.date.getDate()} ${months[this.date.getMonth()]}`;
    }

    // click() {
    //     this.clicks++;
    // }
}

class Running extends Workout {
    type = 'running';

    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence; // in steps/min
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this;
    }
}

class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain; // in steps/min
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        this.speed = this.distance / (this.duration / 60);
        return this;
    }
}

const app = new App();
