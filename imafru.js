Days = new Mongo.Collection("days");

if (Meteor.isClient) {
	var today = new Date();
	today.setHours(0);
	today.setMinutes(0);
	today.setSeconds(0);
	today.setMilliseconds(0);

	var dayoffset = moment(today).isoWeekday() - 1;
	var monday = moment(today).subtract(dayoffset, 'days');
	var sunday = moment(monday).add(6, 'days');
	console.log("Today is " + today);
	console.log("This week's range is " + monday.calendar() + " to " + sunday.calendar());

	Meteor.subscribe("days", today.getTimezoneOffset());
	Meteor.subscribe("userData");

	Accounts.ui.config({
		passwordSignupFields: "USERNAME_AND_OPTIONAL_EMAIL"
	});

	Template.body.helpers({
		'stats': function () {
			//TODO consolidate queries and move to server
			//which should return a stat json object with for now week, then for month
			//http://paletton.com/#uid=43n0u0kI-D2mTJutrIoJqriLxlf

			Session.set("graphHeight", 200);

			var monthly = {};//do like week, maybe factorizeish

			var week = Meteor.users.findOne({_id: Meteor.user()._id}).week;

			if (typeof week == "undefined") return;

			console.log("user weekly goal: " + week.goal);
			console.table(week);

			week.opendaysLeft = 0;
			var range = {"date" : {$gt : today, $lte : sunday.toDate()}, "dayoff" : false};
			Days.find(range).forEach( function (day) { week.opendaysLeft++;});

			range = {"date" : {$gte : monday.toDate(), $lte : sunday.toDate()}, "dayoff" : false};
			week.opendaysTotal= 0;
			Days.find(range).forEach(function (day) {
				week.opendaysTotal++;
			});

			week.total = 0;
			week.max = 0;
			range = {"date" : {$gte : monday.toDate(), $lte : today}, "dayoff" : false};
			var todaysEarning = 0;
			Days.find(range).forEach(function (day) {
				if (day.amount && day.amount > 0) {
					todaysEarning = parseFloat(day.amount);
					week.total += parseFloat(day.amount);
					if (week.max < day.amount) week.max = day.amount;
				}
			});

			week.totalBeforeToday = (week.total - todaysEarning).toFixed(2);

			week.toGoal = Math.max(0, week.goal- week.total);
			
			if(week.opendaysLeft >= 0) week.averageToGoal = parseFloat(week.toGoal/ week.opendaysLeft).toFixed(2);
			else week.averageToGoal="NA";

			range = {"date" : {$gte : monday.toDate(), $lt : today}, "dayoff" : false};
			week.opendaysPassed = 0;
			Days.find(range, {sort: {date: 1}}).forEach(function (day) {
				week.opendaysPassed++;
			});

			range = {"date" : {$gte : today, $lte : sunday.toDate()}};
			week.closeddaysLeft= 0;
			Days.find(range).forEach(function (day) {
				if (day.dayoff) week.closeddaysLeft++;
			});

			week.currentAverage = 0;
			week.pastAverage = 0;
			range = {"date" : {$gte : monday.toDate(), $lt : today}, "dayoff" : false};
			if (week.opendaysPassed >= 0) {
				week.currentAverage = (week.total / week.opendaysPassed).toFixed(2);
				week.pastAverage = (week.totalBeforeToday / week.opendaysPassed).toFixed(2);
			}

			week.pastProjection = (week.total + parseFloat(week.pastAverage) * week.opendaysLeft).toFixed(2);
			week.currentProjection = (week.total + ((parseFloat(week.currentAverage) + parseFloat(week.pastAverage)) * 0.5) * week.opendaysLeft).toFixed(2);

			week.needed = (week.goal - week.total).toFixed(2);
			if (week.needed <= 0) week.needed = "Done!";

			console.log("week -> " + JSON.stringify(week));

			Session.set("week", week);
		},
		'pastDays': function () {
			return Days.find({"date" : {$gte : monday.toDate(), $lt : today}}, {sort : {date : 1}});
		},
		'presentDays': function () {
			return Days.find({"date" : today});
		},
		'futureDays': function () {
			return Days.find({"date" : {$gt : today, $lte : sunday.toDate()}}, {sort : {date : 1}});
		}
	});

	Template.registerHelper('needed', function () {
		var result = 0;
		var week = Session.get("week");
		if (week.opendaysLeft >= 0) result = week.needed / week.opendaysLeft;
		return result.toFixed(2);
	});

	Template.registerHelper('height', function (a, future) {
			var graphHeight = Session.get("graphHeight");

			if (this.dayoff) {
				if (a == "anti") return graphHeight;
				else return 0;
			}

			var week = Session.get("week");
			if (typeof week == "undefined") return;
			var max = week.max * 1.25;
			var ratio;

			if (future == "future") {
				if (week.opendaysLeft >= 0) ratio = week.averageToGoal / max;
				else ratio = 0;

			} else ratio = this.amount / max;

			if (a == "anti") ratio = 1 - ratio;
			ratio = Math.min(Math.max(ratio, 0), 1);

			return graphHeight * ratio;
	});

	Template.registerHelper('offday', function () { return (this.dayoff?"dayoff":"");});

	Template.registerHelper('weekday', function () {
		var names=["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
		var dayofweek = this.date.getDay() - 1;
		if (dayofweek < 0) dayofweek = 6;
		return names[dayofweek];
	});

	Template.week.events({
		'focus input[type="number"]': function (e) { e.target.select();},
		'blur input[type="number"], click input[type="button"], submit form': function (e) {
			e.preventDefault();
			if (Meteor.userId()) {
				var container = e.target.parentNode;
				var amount = container.getElementsByTagName('input')[0].value;
				Meteor.call("editGoal", parseInt(amount).toFixed(0), function (err, data) {
					if (err) console.log("error: [editGoal] -> " + err);
					else console.log("editGoal success");
				});
			}
		}
	});

	Template.week.helpers({
		'projection': function () { return Session.get("projection");},
		'leftvalue': function () {
			var result = "NA";
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			if (week.goal < week.total) result = parseInt(week.goal);
			else result = parseFloat(week.total);
			return result.toFixed(2);

		},
		'rightvalue': function () {
			var result = "NA";
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			if (week.goal < week.total) result = parseInt(week.total - week.goal);
			else result = parseInt(week.goal - week.total);
			return result.toFixed(2);
		},
		'lefthue': function () {
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			return (week.goal<week.total?"week.goaldoneleft":"week.goalleftleft");
		},
		'righthue': function () {
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			return (week.goal<week.total?"week.goaldoneright":"week.goalleftright");
		},
		'left': function () {
			var ratio = 0;
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			if (week.goal < week.total) ratio = week.goal / week.total; 
			else ratio = week.total / week.goal;

			ratio *= 100;

			return ratio.toFixed(0);
		},
		'right': function () {
			var ratio = 100;
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			if (week.goal < week.total) ratio = (week.total - week.goal) / week.total; 
			else ratio = (week.goal - week.total) / week.goal;

			ratio *= 100;

			return ratio.toFixed(0);
		}
	});

	Template.pastDay.events({
		'focus .earning': function (e) { e.target.select();},
		'click .editlock' : function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var form  = container.getElementsByClassName('update')[0];
			form.classList.toggle('dontdisplay');

			var icon = e.target.src.toString().search("lock-unlocked");
			if (icon == -1) e.target.src = e.target.src.replace("lock-locked", "lock-unlocked");
			else e.target.src = e.target.src.replace("lock-unlocked", "lock-locked");
		},
		'click .weekday' : function (e) {
			e.preventDefault();
			Meteor.call("toggleDayOff", this._id, function (err, data) {
				if (err) console.log("error: [toggleDayOff] -> " + err);
				else console.log("toggleDayOff success");
			});
		},
		'click .set': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);

			Meteor.call("editAmount", this._id, parseFloat(amount).toFixed(2), function (err, data) {
				if (err) console.log("error: [editAmount] -> " + err);
				else console.log("editAmount success");
			});
		},
		'click .add': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);

			Meteor.call("addToAmount", this._id, parseFloat(amount).toFixed(2), function (err, data) {
				if (err) console.log("error: [addToAmount] -> " + err);
				else console.log("addToAmount success");
			});
		},
		'submit .update': function (e) { e.preventDefault();}
	});

	Template.pastDay.helpers({
		'performance': function () {
			var result = "";
			var average = Session.get("average");
			if (this.amount > (1.1 * average)) result = "aboveaverage ";
			if (this.amount < (0.7 * average)) result = "belowaverage";
			return result;
		},
		'display': function () { return (this.amount==0?"dontdisplay":"");} 
	});

	Template.presentDay.events({
		'focus .earning': function (e) { e.target.select();},
		'click .today' : function (e) {
			e.preventDefault();
			Meteor.call("toggleDayOff", this._id, function (err, data) {
				if (err) console.log("error: [toggleDayOff] -> " + err);
				else console.log("toggleDayOff success");
			});
		},
		'click .set': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);

			Meteor.call("editAmount", this._id, parseFloat(amount).toFixed(2), function (err, data) {
				if (err) console.log("error: [editAmount] -> " + err);
				else console.log("editAmount success");
			});
		},
		'click .add': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);

			Meteor.call("addToAmount", this._id, parseFloat(amount).toFixed(2), function (err, data) {
				if (err) console.log("error: [addToAmount] -> " + err);
				else console.log("addToAmount success");
			});
		},
		'submit .update': function (e) { e.preventDefault();}
	});	

	Template.presentDay.helpers({
		'display': function () { return (this.amount==0 || this.dayoff==true?"dontdisplay":"");} 
	});

	Template.futureDay.events({
		'click .weekday' : function (e) {
			e.preventDefault();
			Meteor.call("toggleDayOff", this._id, function (err, data) {
				if (err) console.log("error: [toggleDayOff] -> " + err);
				else console.log("toggleDayOff success");
			});
		}
	});	

	Template.futureDay.helpers({
		'difficulty': function () {
			var result = "";
			var week = Session.get("week");
			if (typeof week == "undefined") return;
			if (week.currentAverage> (1.1 * week.averageToGoal)) result = "easy";
			if (week.currentAverage < (0.9 * week.averageToGoal)) result = "hard";
			return result;
		},
		'display': function () { return (this.dayoff==true?"dontdisplay":"");} 
	});
}

if (Meteor.isServer) {
	Accounts.onCreateUser(function(options, user) {
		user.week = {"goal": 50};
		if (options.profile) user.profile = options.profile;
		return user;
	});

	Meteor.publish("userData", function () {
		if (this.userId) {
			return Meteor.users.find({_id: this.userId}, {fields: {'week': 1}});
		} else {
			this.ready();
		}
	});

	Meteor.methods({
		'console': function(m){
			//Meteor.call("console", "Frankenstein!");
			console.log("console: " + m);
		},
		editGoal: function (weeklygoal) {
			if (! Meteor.userId()) {
				throw new Meteor.Error("not-authorized");
			}
			Meteor.users.update(Meteor.userId(), { $set : { "week.goal": weeklygoal}});
		},
		editAmount: function (id, amount) {
			if (! Meteor.userId()) {
				throw new Meteor.Error("not-authorized");
			}
			Days.find(id).forEach( function(d) { console.log("record user id: " + d.owner)});
			Days.update(id, {$set : {amount: amount}});
		},
		addToAmount: function (id, amount) {
			if (! Meteor.userId()) {
				throw new Meteor.Error("not-authorized");
			}
			amount = parseFloat(amount);
			Days.find(id).forEach( function(d) { amount += parseFloat(d.amount);});
			Days.update(id, { $set: {amount: parseFloat(amount).toFixed(2)}});
		},
		toggleDayOff: function (id) {
			if (! Meteor.userId()) {
				throw new Meteor.Error("not-authorized");
			}

			var dayoff;
			//TODO switch to findOne
			Days.find(id).forEach( function(d) { dayoff = d.dayoff;});
			Days.update(id, { $set: {dayoff: !dayoff}});
		}
	});

	Meteor.publish("days", function (offset) {
		if (! this.userId) return; 

		var date = new Date();
		var localoffset = date.getTimezoneOffset();
		var finaloffset = offset - localoffset;
		date.setHours(0);
		date.setMinutes(0);
		date.setSeconds(0);
		date.setMilliseconds(0);
		date = moment(date).add(finaloffset, 'minutes').toDate();

		//Days.remove({"owner": this.userId});

		var weekday = moment(date).isoWeekday() - 1;
		var mon = moment(date).subtract(weekday, 'days');
		var tuesday = moment(mon).add(1, 'days');
		var wednesday = moment(mon).add(2, 'days');
		var thursday = moment(mon).add(3, 'days');
		var friday = moment(mon).add(4, 'days');
		var saturday = moment(mon).add(5, 'days');
		var sun = moment(mon).add(6, 'days');

		var range = {"date" : {$gte : mon.toDate(), $lte : sun.toDate()}, "owner": this.userId};

		if (Days.find(range).count() != 7) {
			Days.remove(range);
			Days.insert({date: mon.toDate(), amount: 0, dayoff: true, owner: this.userId});
			Days.insert({date: tuesday.toDate(), amount: 30.50, dayoff: false, owner: this.userId});
			Days.insert({date: wednesday.toDate(), amount: 10, dayoff: false, owner: this.userId});
			Days.insert({date: thursday.toDate(), amount: 30.9, dayoff: false, owner: this.userId});
			Days.insert({date: friday.toDate(), amount: 57.67, dayoff: false, owner: this.userId});
			Days.insert({date: saturday.toDate(), amount: 48.96, dayoff: false, owner: this.userId});
			Days.insert({date: sun.toDate(), amount: 0, dayoff: true, owner: this.userId});

			//Days.insert({date: mon.toDate(), amount: 0, dayoff: true});
			//Days.insert({date: tuesday.toDate(), amount: 0, dayoff: true});
			//Days.insert({date: wednesday.toDate(), amount: 21.55, dayoff: false});
			//Days.insert({date: thursday.toDate(), amount: 70.04, dayoff: false});
			//Days.insert({date: friday.toDate(), amount: 0, dayoff: false});
			//Days.insert({date: saturday.toDate(), amount: 0, dayoff: false});
			//Days.insert({date: sun.toDate(), amount: 0, dayoff: true});
			
			//Days.insert({date: mon.toDate(), amount: 29.45, dayoff: false});
			//Days.insert({date: tuesday.toDate(), amount: 63.22, dayoff: false});
			//Days.insert({date: wednesday.toDate(), amount: 47.88, dayoff: false});
			//Days.insert({date: thursday.toDate(), amount: 0, dayoff: false});
			//Days.insert({date: friday.toDate(), amount: 0, dayoff: false});
			//Days.insert({date: saturday.toDate(), amount: 0, dayoff: true});
			//Days.insert({date: sun.toDate(), amount: 0, dayoff: true});
			
//			Days.insert({date: mon.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: tuesday.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: wednesday.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: thursday.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: friday.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: saturday.toDate(), amount: 0, dayoff: true, owner: this.userId});
//			Days.insert({date: sun.toDate(), amount: 0, dayoff: true, owner: this.userId});
		}

		console.log("[Publish] -> days for " + date);
		console.log("Today is " + date);
		console.log("This week's range is " + mon.calendar() + " to " + sun.calendar());
		console.log("Dayoffset = " + weekday);
		Days.find(range).forEach(function (day) {
			console.log("Day: " + day.date + " + " + day.amount + " / " + day.dayoff);
		});

		return Days.find(range);
	});
}
