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

	Meteor.startup(function () {
		Session.set("goal", 150);
	});

	Template.body.helpers({
		'stats': function () {
			//TODO consolidate queries and move to server
			//the server returns an object like so {max: 5, total: 25, foo: bar}
			//this functions puts the results in the appropriate session variables
			//http://paletton.com/#uid=43n0u0kI-D2mTJutrIoJqriLxlf
			var goal = Session.get("goal");
			var range = {"date" : {$gte : monday.toDate(), $lte : today}, "dayoff" : false};
			var total = 0;
			var max = 0;
			Days.find(range).forEach(function (day) {
				if (day.amount && day.amount > 0) {
					total += parseFloat(day.amount);
					if (max < day.amount) max = day.amount;
				}
			});

			Session.set("max", max);
			Session.set("total", parseFloat(total).toFixed(2));
			Session.set("graphHeight", 180);

			range = {"date" : {$gte : monday.toDate(), $lte : sunday.toDate()}, "dayoff" : false};
			var activeDays = 0;
			Days.find(range).forEach(function (day) {
				activeDays++;
			});

			Session.set("activeDays", activeDays);

			//Past
			var range = {"date" : {$gte : monday.toDate(), $lt : today}, "dayoff" : false};
			var pastActive = 0;
			Days.find(range, {sort: {date: 1}}).forEach(function (day) {
				pastActive++;
			});

			Session.set("pastActive", pastActive);

			//Present
			range = {"date" : {$gte : monday.toDate(), $lte : today}, "dayoff" : false};
			var earned = parseFloat(0);
			Days.find(range).forEach(function (day) {
				if (day.amount && day.amount > 0) earned += parseFloat(day.amount);
			});

			Session.set("earned", earned.toFixed(2));

			//Future
			range = {"date" : {$gte : today, $lte : sunday.toDate()}};
			var dayoffsLeft = 0;
			Days.find(range).forEach(function (day) {
				if (day.dayoff) dayoffsLeft++;
			});

			Session.set("dayoffsLeft", dayoffsLeft);

			range = {"date" : {$gt : today, $lte : sunday.toDate()}, "dayoff" : false};
			var opendaysLeft = 0;
			Days.find(range).forEach( function (day) { opendaysLeft++;});

			Session.set("opendaysLeft", opendaysLeft);

			//Stats
			var average = "NA";
			range = {"date" : {$gte : monday.toDate(), $lt : today}, "dayoff" : false};
			if (pastActive != 0) { average = (earned / pastActive).toFixed(2);}
			Session.set("average", average);

			var projection = "NA";
			if (pastActive != 0) {
				var daysleft = (7 - dayoffset - dayoffsLeft);

				projection = total;
				if (daysleft != 0) {
					projection = projection  + (average * daysleft);
				}
				projection = parseFloat(projection).toFixed(2);
			}

			Session.set("projection", projection);

			var leftToGoal = Math.max(0, goal - earned);
			var averageLeftToGoal = "NA";
			if (opendaysLeft != 0) averageLeftToGoal = parseFloat(leftToGoal / opendaysLeft).toFixed(2);

			Session.set("averageLeftToGoal", averageLeftToGoal);
			Session.set("opendaysLeft", opendaysLeft);

			var overallAverage = (total / (dayoffset + 1)).toFixed(2); //(day+1) could be 7

			Session.set("overallAverage", overallAverage);

			var needed = "NA";
			needed = (goal - earned).toFixed(2);
			if (needed <= 0) needed = "Done!";

			Session.set("needed", parseFloat(needed).toFixed(2));

			
			console.log("");
			console.log("Full stats");
			console.log("");
			console.log("Goal: " + goal);
			console.log("Max: " + max);
			console.log("Total: " + total);
			console.log("Active days: " + activeDays);
			console.log("Past Active: " + pastActive);
			console.log("Earned: " + earned);
			console.log("Days Off Left: " + dayoffsLeft);
			console.log("Open Days Left: " + opendaysLeft);
			console.log("Average: " + average);
			console.log("Average Left To Goal: "  + averageLeftToGoal);
			console.log("Needed: "  + needed);
			console.log("Projection: " + projection);
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

	Template.week.events({
		'focus input[type="number"]': function (e) { e.target.select();},
		'blur input[type="number"], click input[type="button"], submit form': function (e) {
			e.preventDefault();
			var container = e.target.parentNode;
			var amount = container.getElementsByTagName('input')[0].value;
			Session.set("goal", parseInt(amount).toFixed(0));
		}
	});

	Template.week.helpers({
		'goal': function () { return Session.get("goal");},
		'projection': function () { return Session.get("projection");},
		'leftvalue': function () {
			var result = "NA";
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			if (goal < total) result = parseInt(goal);
			else result = parseFloat(total);
			return result.toFixed(2);

		},
		'rightvalue': function () {
			var result = "NA";
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			if (goal < total) result = parseInt(total - goal);
			else result = parseInt(goal - total);
			return result.toFixed(2);
		},
		'lefthue': function () {
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			return (goal<total?"goaldoneleft":"goalleftleft");
		},
		'righthue': function () {
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			return (goal<total?"goaldoneright":"goalleftright");
		},
		'left': function () {
			var ratio = 0;
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			if (goal < total) ratio = goal / total; 
			else ratio = total / goal;

			ratio *= 100;

			return ratio.toFixed(0);
		},
		'right': function () {
			var ratio = 100;
			var goal = parseFloat(Session.get("goal"));
			var total = parseFloat(Session.get("total"));
			if (goal < total) ratio = (total - goal) / total; 
			else ratio = (goal - total) / goal;

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
			console.log("edit: + " + e.target.src);
			console.log("icon: + " + icon);
			if (icon == -1) e.target.src = e.target.src.replace("lock-locked", "lock-unlocked");
			else e.target.src = e.target.src.replace("lock-unlocked", "lock-locked");
			console.log("edit: + " + e.target.src);
		},
		'click .weekday' : function (e) {
			e.preventDefault();
			Days.update(this._id, {$set : {dayoff : !this.dayoff}});
		},
		'click .set': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);
			Days.update(this._id, { $set: {amount: parseFloat(amount).toFixed(2)}});
		},
		'click .add': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);
			Days.find(this._id).forEach( function(d) { amount += parseFloat(d.amount);});
			Days.update(this._id, { $set: {amount: parseFloat(amount).toFixed(2)}});
		},
		'submit .update': function (e) { e.preventDefault();}
	});

	Template.pastDay.helpers({
		'offday': function () { return (this.dayoff?"dayoff":"");},
		'weekday': function () {
			var names=["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
			var dayofweek = this.date.getDay() - 1;
			if (dayofweek < 0) dayofweek = 6;
			return names[dayofweek];
		},
		'performance': function () {
			var result = "";
			var average = Session.get("average");
			if (this.amount > (1.2 * average)) result = "aboveaverage ";
			if (this.amount < (0.6 * average)) result = "belowaverage";
			return result;
		},
		'height': function (a) {
			var graphHeight = Session.get("graphHeight");

			if (this.dayoff) {
				if (a == "anti") return graphHeight;
				else return 0;
			}

			var max = Session.get("max");
			var ratio = this.amount / (1.25 * max);

			if (a == "anti") ratio = 1 - ratio;
			ratio = Math.min(Math.max(ratio, 0), 1);

			return graphHeight * ratio;
		},
		'display': function () { return (this.amount==0?"dontdisplay":"");} 
	});

	Template.presentDay.events({
		'focus .earning': function (e) { e.target.select();},
		'click .today' : function (e) {
			e.preventDefault();
			Days.update(this._id, {$set : {dayoff : !this.dayoff}});
		},
		'click .set': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);
			Days.update(this._id, { $set: {amount: parseFloat(amount).toFixed(2)}});
		},
		'click .add': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = parseFloat(container.getElementsByClassName('earning')[0].value);
			Days.find(this._id).forEach( function(d) { amount += parseFloat(d.amount);});
			Days.update(this._id, { $set: {amount: parseFloat(amount).toFixed(2)}});
		},
		'submit .update': function (e) { e.preventDefault();}
	});	

	Template.presentDay.helpers({
		'offday': function () { return (this.dayoff?"dayoff":"");},
		'weekday': function () {
			var names=["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
			var dayofweek = this.date.getDay() - 1;
			if (dayofweek < 0) dayofweek = 6;
			return names[dayofweek];
		},
		'needed': function () {
			var result = Session.get("averageLeftToGoal");
			return Math.max(result - this.amount, 0);
			//var averageLeftToGoal = Session.get("averageLeftToGoal");
			//console.log("Checking: " + averageLeftToGoal);
			//if (typeof averageLeftToGoal != "undefined" && averageLeftToGoal != 0) {
			//	console.log(Session.get("averageLeftToGoal") + " YOYO");
			//	return (Session.get("averageLeftToGoal") - this.amount);
			//} else {
			//	console.log("No thing");
			//	return "b";
			//}
			//return Session.get("averageLeftToGoal");
		},
		'height': function (a) {
			var graphHeight = Session.get("graphHeight");

			if (this.dayoff) {
				if (a == "anti") return graphHeight;
				else return 0;
			}

			var max = Session.get("max");
			var ratio = this.amount / (1.25 * max);

			if (a == "anti") ratio = 1 - ratio;
			ratio = Math.min(Math.max(ratio, 0), 1);

			return graphHeight * ratio;
		},
		'display': function () { return (this.amount==0 || this.dayoff==true?"dontdisplay":"");} 
	});

	Template.futureDay.events({
		'click .weekday' : function (e) {
			e.preventDefault();
			Days.update(this._id, {$set : {dayoff : !this.dayoff}});
		},
		'click .updateButton': function (e) {
			e.preventDefault();
			var target = e.target;
			var container = target.parentNode;
			var amount = container.getElementsByTagName('input')[0];
			Days.update(this._id, { $set: {amount: parseInt(amount.value).toFixed(2)}});
		}
	});	

	Template.futureDay.helpers({
		'offday': function () { return (this.dayoff?"dayoff":"");},		
		'needed': function () {
			var result = Session.get("averageLeftToGoal");
			return result;
		},
		'difficulty': function () {
			var result = "";
			var average = Session.get("average");
			var averagetogoal = Session.get("averageLeftToGoal");
			if (average > (1.2 * averagetogoal)) result = "easy";
			if (average < (0.8 * averagetogoal)) result = "hard";
			return result;
		},
		'weekday': function () {
			var names=["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
			var dayofweek = this.date.getDay() - 1;
			if (dayofweek < 0) dayofweek = 6;
			return names[dayofweek];
		},
		'height': function (a) {
			var graphHeight = Session.get("graphHeight");
			if (this.dayoff) {
				if (a == "anti") return graphHeight;
				else return 0;
			}

			var total = Session.get("total"); // or 0
			var dayoffsLeft = Session.get("dayoffsLeft"); //or 0
			var activeDaysLeft = (7 - dayoffset - dayoffsLeft);

			var max = Session.get("max");
			var adjMax = 1.25 * max;

			var goal = parseFloat(Session.get("goal"));

			var ratio;
			if (activeDaysLeft != 0) {
				if (a != "anti") ratio = (((goal - total) / activeDaysLeft) / adjMax);
				else ratio = 1 - (((goal - total) / activeDaysLeft) / adjMax);
			} else ratio = 0;

			ratio = Math.min(Math.max(ratio, 0), 1);
			console.log("Future height: " + ratio);

			return graphHeight * ratio; 
		},
		'display': function () { return (this.dayoff==true?"dontdisplay":"");} 
	});
}

if (Meteor.isServer) {
	Meteor.methods({
		'console': function(m){
			//Meteor.call("console", "Frankenstein!");
			console.log("console: " + m);
		},
		'weeklymax': function () {
			var range = {"date" : {$gte : monday.toDate(), $lte : today}, "dayoff" : false};

			var max = 0;
			Days.find(range).forEach(function (day) {
				if (day.amount && day.amount > max) max = day.amount.toFixed(2);
			});

			return max;
		}
	});

	Meteor.publish("days", function (offset) {
		var date = new Date();
		var localoffset = date.getTimezoneOffset();
		var finaloffset = offset - localoffset;
		date.setHours(0);
		date.setMinutes(0);
		date.setSeconds(0);
		date.setMilliseconds(0);
		date = moment(date).add(finaloffset, 'minutes').toDate();

		console.log("[Publish] -> days for " + date);

		//Days.remove({});

		var weekday = moment(date).isoWeekday() - 1;
		var mon = moment(date).subtract(weekday, 'days');
		var sun = moment(mon).add(6, 'days');

		var before = moment(mon).subtract(1, 'days');
		var tuesday = moment(mon).add(1, 'days');
		var wednesday = moment(mon).add(2, 'days');
		var thursday = moment(mon).add(3, 'days');
		var friday = moment(mon).add(4, 'days');
		var saturday = moment(mon).add(5, 'days');
		var after = moment(mon).add(7, 'days');

		var range = {"date" : {$gte : mon.toDate(), $lte : sun.toDate()}};
		console.log("Today is " + date);
		console.log("This week's range is " + mon.calendar() + " to " + sun.calendar());
		console.log("Dayoffset = " + weekday);

		var range = {"date" : {$gte : mon.toDate(), $lte : sun.toDate()}};

		if (Days.find(range).count() != 7) {
			Days.remove(range);
			//Days.insert({date: mon.toDate(), amount: 0, dayoff: true});
			//Days.insert({date: tuesday.toDate(), amount: 30.50, dayoff: false});
			//Days.insert({date: wednesday.toDate(), amount: 10, dayoff: false});
			//Days.insert({date: thursday.toDate(), amount: 30.9, dayoff: false});
			//Days.insert({date: friday.toDate(), amount: 57.67, dayoff: false});
			//Days.insert({date: saturday.toDate(), amount: 48.96, dayoff: false});
			//Days.insert({date: sun.toDate(), amount: 0, dayoff: true});
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
			
			Days.insert({date: mon.toDate(), amount: 0, dayoff: true});
			Days.insert({date: tuesday.toDate(), amount: 0, dayoff: true});
			Days.insert({date: wednesday.toDate(), amount: 0, dayoff: true});
			Days.insert({date: thursday.toDate(), amount: 0, dayoff: true});
			Days.insert({date: friday.toDate(), amount: 0, dayoff: true});
			Days.insert({date: saturday.toDate(), amount: 0, dayoff: true});
			Days.insert({date: sun.toDate(), amount: 0, dayoff: true});
		}

		Days.find(range).forEach(function (day) {
			console.log("Day: " + day.date + " + " + day.amount + " / " + day.dayoff);
		});

		return Days.find(range);
	});
}
