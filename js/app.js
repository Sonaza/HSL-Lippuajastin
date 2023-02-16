
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
	
	const time_parts = input_string.split(/\.|:/);
	if (time_parts.length !== 2)
	{
		const minute_offset = parseInt(input_string);
		if (!isNaN(minute_offset))
		{
			return new Date(new Date().getTime() + minute_offset * 60 * 1000);
		}
		return undefined;
	}
	
	const [hourStr, minuteStr] = time_parts;
	const hour = parseInt(hourStr);
	const minute = parseInt(minuteStr);
	const now = new Date();
	
	// Times given up to 110 minutes into the past are accepted but beyond that count as next day instead
	const diff = (now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).getTime()) / 1000 / 60;
	if (!(diff >= -110 && (hour > now.getHours() || (hour === now.getHours() && minute > now.getMinutes()))))
	{
		now.setDate(now.getDate() + 1);
	}
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
}

app.controller('MainController', async ($rootScope, $scope, $timeout, $interval, $sce) =>
{
	$scope.tickets = [
		new Ticket('AB',   80),
		new Ticket('ABC',  90),
		new Ticket('ABCD', 110),
		new Ticket('BC',   80),
		new Ticket('BCD',  100),
		new Ticket('CD',   90),
		new Ticket('D',    80),
	];
	
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
	
	$scope.edit_start = () =>
	{
		const default_value = ($scope.current_ticket.custom_start || new Date()).toLocaleTimeString("fi-FI", {
			timeStyle: 'short',
		});
		
		const custom_start = prompt("Valitse lipun aloitusajankohta.\n\nSyötä aika muodossa HH.MM tai vaihtoehtoisesti erotus minuuteissa:", default_value);
		$scope.current_ticket.custom_start = parse_time_string(custom_start);
	}
	
	$scope.current_custom_start = () =>
	{
		if ($scope.current_ticket.custom_start === undefined)
			return '';
		
		const custom_start = $scope.current_ticket.custom_start.toLocaleTimeString("fi-FI", {
			timeStyle: 'short',
		});
		return ' [klo {}]'.format(custom_start);
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
