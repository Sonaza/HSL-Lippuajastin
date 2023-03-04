
var app = angular.module('app', ['ngSanitize']);

app.config(($interpolateProvider) =>
{
	// $interpolateProvider.startSymbol('[[');
	// $interpolateProvider.endSymbol(']]');
});

app.run(($rootScope, $window, $http) =>
{
});

class Ticket
{
	identifier;
	minutes;
	html;
	
	constructor(identifier, minutes)
	{
		this.identifier = identifier;
		this.minutes = minutes;
		
		this.html = '';
		for (let i = 0; i < this.identifier.length; ++i)
		{
			this.html += '<span>' + this.identifier.charAt(i) + '</span>';
		}
	}
}

function parse_time_string(input_string)
{
	if (input_string === null)
		return undefined;
	
	const now = new Date();
	
	const time_parts = input_string.split(/\.|:/);
	if (time_parts.length !== 2)
	{
		const minute_offset = parseInt(input_string);
		if (!isNaN(minute_offset) && minute_offset > -110 && minute_offset < 1440)
		{
			return new Date(now.getTime() + minute_offset * 60 * 1000);
		}
		return undefined;
	}
	
	const [hourStr, minuteStr] = time_parts;
	if (!(hourStr.length != 1 || hourStr.length != 2) || minuteStr.length != 2)
		return undefined;
	
	const hour = parseInt(hourStr);
	const minute = parseInt(minuteStr);
	if (isNaN(hour) || isNaN(minute))
		return undefined;
	
	return handle_futurepast(new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute));
}

function get_datetime(hours, minutes)
{
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
}

// Wraps a date based on the time only so that relative to the given `now`
// the date becomes yesterday, today or tomorrow when crossing midnight.
function wrap_date(now, date_value)
{
	const hour = date_value.getHours();
	const minute = date_value.getMinutes();
	date_value = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
	
	const past   = new Date(date_value.getTime() - 24 * 3600 * 1000);
	const future = new Date(date_value.getTime() + 24 * 3600 * 1000);
	
	const diff_present = Math.abs((now.getTime() - date_value.getTime()) / 1000 / 60);
	const diff_past    = ((now.getTime() - past.getTime()) / 1000 / 60);
	const diff_future  = ((future.getTime() - now.getTime()) / 1000 / 60);
	
	if (diff_present < diff_past && diff_present < diff_future)
	{
		return date_value;
	}
	
	if (diff_past < diff_future)
	{
		return past;
	}
	else
	{
		return future;
	}
}

function handle_futurepast(new_date)
{
	if (!new_date)
		return undefined;
	
	const now = new Date();
	
	const hour = new_date.getHours();
	const minute = new_date.getMinutes();
	new_date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
	
	const date_wrapped = wrap_date(now, new_date);
	
	const max_ticket_duration = 110;
	const ticket_deadline = new Date(now.getTime() - max_ticket_duration * 60 * 1000);
	
	console.log("date_wrapped", date_wrapped)
	console.log("new_date", new_date)
	console.log("ticket_deadline", ticket_deadline);
	
	if (new_date < ticket_deadline)
	{
	}
	
	if (date_wrapped > ticket_deadline)
	{
		return date_wrapped;
	}
	
	return new_date;
}

class BusStop
{
	label;
	url;
	
	constructor(label, url)
	{
		this.label = label;
		this.url   = url;
	}
}

app.directive('iframeSrc', function($parse, $timeout, $sce)
{
	return {
		restrict: 'A',
		scope: true,
		link: function (scope, element, attrs)
		{
			scope.$parent.$watch(attrs.iframeSrc, function(condition)
			{
				const src_url = $parse(attrs.iframeSrc)(scope.$parent);
				element[0].setAttribute('src', $sce.trustAsResourceUrl(src_url));
			});
		}
	}
});

app.controller('MainController', async ($rootScope, $scope, $timeout, $interval, $filter, $sce, $window) =>
{
	$scope.body_classes = () =>
	{
		let output = [];
		
		if ($scope.bus_stops.visible)
		{
			output.push('unscrollable');
		}
		
		return output.join(' ')
	}
	
	$scope.tickets = [
		new Ticket('AB',   80),
		new Ticket('ABC',  90),
		new Ticket('ABCD', 110),
		new Ticket('BC',   80),
		new Ticket('BCD',  100),
		new Ticket('CD',   90),
		new Ticket('D',    80),
	];
	
	$scope.bus_stops = {
		visible  : false,
		selected : 0,
		list     : [
			// Urls are for https://omatnaytot.hsl.fi
			new BusStop('Lukutori',      '2dbbd932-960e-57d6-9763-8b581470ad1b'),
			new BusStop('Piispanaukio',  'a1ccf80d-9de4-5a06-8240-8b524d3dd106'),
			new BusStop('Matinkylä (M)', 'bad3a022-578c-55ea-818a-4970d39fd68e'),
			new BusStop('Sello',         '9f5bdee5-ec3e-57c5-bdb8-8d6c77392a28'),
		],
		get_current_url : () =>
		{
			const current_stop = $scope.bus_stops.list[$scope.bus_stops.selected];
			if (!current_stop)
				return '';
			
			// return $sce.trustAsResourceUrl('https://omatnaytot.hsl.fi/static/?url=' + current_stop.url);
			return 'https://omatnaytot.hsl.fi/static/?url=' + current_stop.url;
		}
	}
	
	$scope.bus_stops.stop_selected = (stop_index) =>
	{
		if ($scope.bus_stops.selected == stop_index)
			return 'selected';
		return '';
	}
	
	$scope.find_ticket = (identifier) =>
	{
		for (const ticket of $scope.tickets)
		{
			if (ticket.identifier == identifier)
				return ticket;
		}
		return undefined;
	}
	
	$scope.ticket_chosen_class = (ticket) =>
	{
		if ($scope.current_ticket?.changing_ticket)
		{
			if (ticket.identifier == $scope.current_ticket.ticket.identifier)
			{
				return 'chosen-ticket';
			}
		}
		
		return '';
	}
	
	$scope.current_ticket = {
		has_ticket    : await Utility.get_storage('has_ticket', false),
		bought_on     : await Utility.get_storage('bought_on', ''),
		identifier    : await Utility.get_storage('identifier', ''),
		ticket        : undefined,
		expired       : false,
		custom_start  : undefined,
	}
	
	$scope.edit_ticket = {
		opened        : false,
		default_value : undefined,
		custom_start  : undefined,
		custom_start_value  : undefined,
		dirty         : false,
		input_field   : document.querySelector('#edit-dialog .current-value')
	}
	
	$scope.edit_ticket.value_class = () =>
	{
		if (!$scope.edit_ticket.valid)
			return 'invalid';
		if ($scope.edit_ticket.dirty)
			return 'dirty';
		return '';
	}
	
	let date_equals = (a, b) =>
	{
		if (a instanceof Date && b instanceof Date)
		{
			return Math.floor(a.getTime() / 60000) == Math.floor(b.getTime() / 60000);
		}
		return false;
	}
	
	$scope.edit_ticket.open = () =>
	{
		$timeout(() =>
		{
			$scope.edit_ticket.opened = true;
			
			const now = new Date();
			$scope.edit_ticket.default_value = ($scope.current_ticket.custom_start || now);
			
			$scope.edit_ticket.custom_start = undefined;
			$scope.edit_ticket.valid = true;
			
			$timeout(() =>
			{
				$scope.edit_ticket.custom_start = $scope.edit_ticket.default_value;
				$scope.edit_ticket.valid = true;
				
				$timeout(() =>
				{
					document.querySelector('#edit-dialog .current-value').focus();
					// document.querySelector('#edit-dialog .current-value').click();
					$scope.edit_ticket.dirty = false;
				});
			
			});
		})
	}
	
	$scope.$watch('edit_ticket.custom_start', function(new_value, old_value)
	{
		if (!$scope.edit_ticket.opened)
			return;
		
		// $scope.edit_ticket.custom_start_value = $filter('date')(new_value, 'HH:mm');
		
		$scope.edit_ticket.valid = new_value instanceof Date;
		$scope.edit_ticket.dirty = !date_equals(new_value, $scope.edit_ticket.default_value);
	}, true);
	
	$scope.edit_ticket.increment = (diff) =>
	{
		const parsed_time = $scope.edit_ticket.custom_start || new Date();
		const new_time = new Date(parsed_time.getTime() + diff * 60 * 1000);
		
		$scope.edit_ticket.custom_start = new_time;
	}
	
	$scope.handle_futurepast = handle_futurepast;
	
	
	$scope.edit_ticket.reset = () =>
	{
		$timeout(() =>
		{
			$scope.edit_ticket.custom_start = $scope.edit_ticket.default_value;
			
			$timeout(() =>
			{
				$scope.edit_ticket.dirty = false;
			});
		});
	}
	
	$scope.edit_ticket.cancel = () =>
	{
		$timeout(() =>
		{
			$scope.edit_ticket.opened = false;
		});
	}
	
	$scope.edit_ticket.submit = () =>
	{
		// console.log("valid", $scope.edit_ticket.valid);
		// console.log("dirty", $scope.edit_ticket.dirty);
		
		const date_handled = handle_futurepast($scope.edit_ticket.custom_start);
		// console.log(date_handled);
		if ($scope.edit_ticket.valid && $scope.edit_ticket.dirty)
		{
			$scope.current_ticket.custom_start = date_handled;
		}
		else
		{
			$scope.current_ticket.custom_start = undefined;
		}
		
		$scope.edit_ticket.opened = false;
	}
	
	angular.element($window).on('click', ($event) =>
	{
		if (!$scope.edit_ticket.opened)
			return;
		
		if ($event.target.closest('#edit-dialog .inner'))
			return;
		
		$scope.edit_ticket.cancel();
		$event.preventDefault();
	});
	
	angular.element($window).on('keydown', ($event) =>
	{
		if ($event.repeat || $event.ctrlKey || $event.altKey || $event.metaKey) return;
		
		if ($event.keyCode == 27) // ESC-key
		{
			$scope.edit_ticket.cancel();
			$event.preventDefault();
			return;
		}
	});
	
	$scope.edit_start = () =>
	{
		$scope.edit_ticket.open();
	}
	
	$scope.current_custom_start = () =>
	{
		if ($scope.current_ticket.custom_start === undefined)
			return '';
		
		const custom_start = $scope.current_ticket.custom_start.toLocaleTimeString("fi-FI", {
			timeStyle: 'short',
		});
		return '{}'.format(custom_start);
	}
	
	$scope.restore_from_storage = () =>
	{
		if (!$scope.current_ticket.has_ticket)
			return;
		
		if ($scope.current_ticket.bought_on === '')
		{
			$scope.current_ticket.has_ticket = false;
			return;
		}
		
		if ($scope.current_ticket.identifier === '')
		{
			$scope.current_ticket.has_ticket = false;
			return;
		}
		
		$scope.current_ticket.ticket = $scope.find_ticket($scope.current_ticket.identifier);
		
		if ($scope.current_ticket.ticket === undefined)
		{
			$scope.current_ticket.has_ticket = false;
			return;
		}
		
		$scope.current_ticket.bought_on  = new Date(JSON.parse($scope.current_ticket.bought_on));
		$scope.current_ticket.expires_on = new Date($scope.current_ticket.bought_on.getTime() + $scope.current_ticket.ticket.minutes * 60000);
		
		const diff = ($scope.current_ticket.expires_on.getTime() - new Date().getTime()) / 1000;
		$scope.current_ticket.expired = (diff < 0);
		
		if (!$scope.current_ticket.expired)
		{
			$scope.setup_interval();
		}
		else
		{
			// Return to ticket selection if ticket has expired more than 3 hours ago
			if (Math.abs(diff) > 3 * 3600)
			{
				$scope.current_ticket.has_ticket = false;
				Utility.save_storage({
					has_ticket : false,
				});
			}
		}
	}
	
	$scope.is_ticket_bought_yet = () =>
	{
		return $scope.current_ticket.has_ticket && 
			   $scope.current_ticket.bought_on !== undefined &&
			   new Date() >= $scope.current_ticket.bought_on;
	}
	
	$scope.remaining_minutes = () =>
	{
		if (!$scope.current_ticket.has_ticket)
			return 'Ei lippua';
		
		if ($scope.current_ticket.expires_on === undefined)
			return;
		
		const diff = Math.max(0, ($scope.current_ticket.expires_on.getTime() - new Date().getTime()) / 1000);
		return $sce.trustAsHtml(Utility.format_seconds(Math.ceil(diff)));
	}
	
	$scope.validity_ends_on = () =>
	{
		if (!$scope.current_ticket.has_ticket)
			return 'Ei lippua';
		
		if ($scope.current_ticket.expires_on === undefined)
			return;
		
		return $scope.current_ticket.expires_on.toLocaleTimeString("fi-FI", {
			timeStyle: 'short',
		});
	}
	
	$scope.ticket_bought_on = () =>
	{
		if (!$scope.current_ticket.has_ticket)
			return 'Ei lippua';
		
		if ($scope.current_ticket.bought_on === undefined)
			return;
		
		return $scope.current_ticket.bought_on.toLocaleString("fi-FI", {
			dateStyle: 'medium',
			timeStyle: 'short',
		});
	}
	
	$scope.reset_ticket = () =>
	{
		if ($scope.current_ticket.expired || confirm('Oletko varma? Uuden lipun voimassaolo alkaa alusta.'))
		{
			$interval.cancel($scope.update_interval);
			$scope.current_ticket.has_ticket = false;
			$scope.current_ticket.expired = false;
			$scope.current_ticket.custom_start = undefined;
			
			Utility.save_storage({
				has_ticket : false,
			});
		}
	}
	
	$scope.soft_reset_ticket = () =>
	{
		$scope.current_ticket.changing_ticket = true;
	}
	
	$scope.setup_interval = () =>
	{
		$interval.cancel($scope.update_interval);
		
		$scope.update_interval = $interval(() =>
		{
			$scope.current_ticket.expired = new Date().getTime() >= $scope.current_ticket.expires_on.getTime();
			if ($scope.current_ticket.expired)
			{
				$interval.cancel($scope.update_interval);
			}
		},
		500);
	}
	
	$scope.choose_ticket = (ticket) =>
	{
		$timeout(() =>
		{
			$scope.current_ticket.has_ticket = true;
			$scope.current_ticket.ticket     = ticket;
			$scope.current_ticket.expired    = false;
			
			if (!$scope.current_ticket.changing_ticket)
			{
				$scope.current_ticket.bought_on = $scope.current_ticket.custom_start || new Date();
			}
			$scope.current_ticket.changing_ticket = false;
			
			$scope.current_ticket.expires_on = new Date($scope.current_ticket.bought_on.getTime() + ticket.minutes * 60000);
			
			Utility.save_storage({
				has_ticket : true,
				bought_on  : JSON.stringify($scope.current_ticket.bought_on.toJSON()),
				identifier : ticket.identifier,
			});
		});
		
		$scope.setup_interval();
	}
	
	$scope.$apply(() =>
	{
		$scope.restore_from_storage();
	});
	
	angular.element(document.querySelectorAll(".ng-cloak")).removeClass('ng-cloak');
});
