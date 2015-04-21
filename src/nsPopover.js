/**
 * This is a completely rewritten version of nsPopover,
 * with groups, themes, and a few other features missing
 *
 * It doesnt compile until the user performs the trigger action, which saves
 * quite a bit of processing and memory when used in lists
 */
(function(window, angular, undefined){
  'use strict';

  var module = angular.module('nsPopover', []);
  var $el = angular.element;
  var isDef = angular.isDefined;

  module.provider('nsPopover', function () {
    var defaults = {
      template: '',
      plain: false,
      trigger: 'click',
      triggerPrevent: true,
      angularEvent: false,
      scopeEvent: false,
      container: 'body',
      placement: 'bottom|left',
      timeout: 1.5,
      hideOnInsideClick: false,
      hideOnOutsideClick: true,
      hideOnButtonClick: true,
      popupDelay: 0,
      hideEvent: null,
      propagate: false
    },
    id = 0;

    this.$get = function ($templateCache, $q) {
      return {
        getDefaults: function () {
          return defaults;
        },
        placementOptions: ['top', 'bottom', 'left', 'right'],
        alignOptions: ['top', 'bottom', 'center', 'left', 'right'],
        /**
         * Load the given template in the cache if it is not already loaded.
         *
         * @param template The URI of the template to be loaded.
         * @returns {String} A promise that the template will be loaded.
         * @remarks If the template is null or undefined a empty string will be returned.
         */
        loadTemplate: function(template, plain) {
          var defer = $q.defer(),
            fromCache = $templateCache.get(template);

          if (!template) {
            defer.resolve('');
          } else if(angular.isString(template) && plain) {
            defer.resolve(template);
          } else if(fromCache){
            defer.resolve(fromCache);
          } else {
            $http.get(template, { cache : true }).then(function(res){
              defer.resolve(( angular.isString(res.data) ? res.data : ''));
            });
          }

          return defer.promise;
        },
        /* this method is probably stupid, but im tired */
        getAttrs: function(attrs){
          for(var prop in attrs){
            if(attrs.hasOwnProperty(prop) && prop.indexOf('nsPopover') === 0){
              var propName = prop.substr(9,1).toLowerCase() + prop.substr(10);
              attrs[propName] = attrs[prop];
            }
          }

          attrs.id = 'popover-' + id;

          id++;

          return attrs;
        },
        positionY: function(rect, popoverRect, align) {
          if (align === 'center') {
            return Math.round(rect.top + rect.height/2 - popoverRect.height/2);
          } else if(align === 'bottom') {
            return rect.bottom - popoverRect.height;
          }
          return rect.top;
        },
        positionX: function(rect, popoverRect, align){
          if (align === 'center') {
            return Math.round(rect.left + rect.width/2 - popoverRect.width/2);
          } else if(align === 'right') {
            return rect.right - popoverRect.width;
          }
          return rect.left;
        }
      };
    };
  });

  module.directive('nsPopover', ['nsPopover','$rootScope','$timeout', '$http','$compile','$document','$parse',
    function(nsPopover, $rootScope, $timeout, $http, $compile, $document, $parse) {
      return {
        restrict: 'A',
        scope: true,
        link: link
      };

      function link(scope, elm, attrs) {
          //need to strip the props of nsPopover prefix
          var options = angular.extend(angular.copy(nsPopover.getDefaults()), nsPopover.getAttrs(attrs)),
            $container,
            $popover,
            $triangle,
            displayTimeout,
            splitOptions = options.placement.split('|'),
            placement = nsPopover.placementOptions.indexOf(splitOptions[0]) > -1 ? splitOptions[0] : 'bottom',
            align = splitOptions[1] || 'center',
            listeners = [], //internal listeners to detach on $destroy
            domListeners = [],
            unbindTrigger;

          scope.hidePopover = destroy;

          elm.attr('popover-id', options.id);
          /**
          * Create our popover, then put it on the page
          */
          function createPopover(){
            nsPopover.loadTemplate(options.template, options.plain)
            .then(function(template) {
              $container = $el($document[0].body);

              $popover = $el('<div id="'+ options.id + '" class="ns-popover-list-theme ns-popover-' + placement +
                '-placement ns-popover-' + align + '-align" style="position:absolute; visibility: hidden;">'+template+'</div>');

              //search for the triangle element - works in ie8+
              $triangle = $popover[0].querySelectorAll('.triangle');

              //if the element is found, then convert it to an angular element
              if($triangle.length){
                $triangle = $el($triangle);
              }

              var childScope = scope.$new();
              $compile($popover)(childScope);

              addListeners($popover);

              $timeout.cancel(displayTimeout);
              displayTimeout = $timeout(function(){
                var elmRect = getBoundingClientRect(elm[0]);
                move($popover, $container, elmRect, $triangle);
              }, options.popupDelay);

              // Add classes that identifies the placement and alignment of the popver
              // which allows the customization of the popover based on its position.
              listeners.push(scope.$on('$destroy', destroy));
            });
          }


          //detach all of our event listeners
          function detachListeners(){
            //detach internal listeners
            for(var i = 0; i <listeners.length; i++){
              if(angular.isFunction(listeners[i])){
                listeners[i]();
              }
            }

            //detach dom listeners
            for(var i = 0; i < domListeners.length; i++){
              if(angular.isFunction(domListeners[i])){
                domListeners[i]();
              }
            }
          }

          function destroy(){
            if($popover){
              $popover.remove();
              detachListeners();

              //remove all dom references so garbage collection can be done
              $triangle = null;
              $container = null;
              $popover = null;
            }
          }

          function addListeners(){
            options.hideOnInsideClick = (options.hideOnInsideClick === true || options.hideOnInsideClick === 'true');
            options.hideOnOutsideClick = (options.hideOnOutsideClick === true || options.hideOnOutsideClick === 'true');
            options.hideOnButtonClick = (options.hideOnButtonClick === true || options.hideOnButtonClick === 'true');
            //internal listeners
            if(options.hideEvent){
              listeners.push(scope.$on(options.hideEvent, destroy));
            }

            //DOM listeners
            if (options.hideOnInsideClick) {
              // Hide the popover without delay on the popover click events.
              $popover.on('click', destroy);

              domListeners.push(function(){
                $popover.off('click', destroy);
              });
            }

            if (options.hideOnOutsideClick) {
              // Hide the popover without delay on outside click events.
              $document.on('click', outsideClickHandler);

              domListeners.push(function(){ $document.off('click', outsideClickHandler) });
            }

            if (options.hideOnButtonClick) {
              // Hide the popover without delay on the button click events.
              elm.on('click', destroy);

              domListeners.push(function(){
                elm.off('click', destroy);
              });
            }

            if(options.trigger === 'mouseenter'){
              elm.on('mouseleave', function(e) {
                if($el(e.target).attr('popover-id') !== options.id){
                  destroy();
                  $timeout(init, 0);
                }
              });
              $popover.on('mouseleave', function(){
                destroy();
                $timeout(init, 0);
              });

              domListeners.push(function(){
                elm.off('mouseleave', destroy);
                $popover.off('mouseleave', destroy);
              });
            }
          }

          /**
           * Init listener event
           */
          function init(){
            if (options.angularEvent) {
              listeners.push($rootScope.$on(options.angularEvent, createPopover));
            } else if (options.scopeEvent) {
              listeners.push(scope.$on(options.scopeEvent, createPopover));
            } else {
              elm.on(options.trigger, optionsTrigger);

              unbindTrigger = function(){
                  elm.off(options.trigger, optionsTrigger)
              };

              scope.$on('$destroy', unbindTrigger);
            }
          }

          init();

          function optionsTrigger(e) {

            if(options.triggerPrevent !== false) {
              e.preventDefault();
            }

            if(angular.isFunction(e.stopPropagation) && !options.propagate){
              e.stopPropagation();
            }

            if($parse(attrs.nsPopover)(scope) !== false && !$popover){
              createPopover();
            }

            if(options.trigger === 'mouseenter' || options.trigger === 'mouseover'){
              unbindTrigger();
            }
          }

          /**
           * Move the popover to the |placement| position of the object located on the |rect|.
           *
           * @param popover {Object} The popover object to be moved.
           * @param rect {ClientRect} The ClientRect of the object to move the popover around.
           * @param triangle {Object} The element that contains the popover's triangle. This can be null.
           */
          function move(popover, container, rect, triangle) {
            container.append(popover);

            // the timeout here allows for the popover to render and it's
            // width to be calculated properly
            $timeout(function(){
              var popoverRect = getBoundingClientRect(popover[0]);
              var top, left;

              if (placement === 'top') {
                top = rect.top - popoverRect.height;
                left = nsPopover.positionX(rect, popoverRect, align);
              } else if (placement === 'right') {
                top = nsPopover.positionY(rect, popoverRect, align);
                left = rect.right;
              } else if (placement === 'bottom') {
                top = rect.bottom;
                left = nsPopover.positionX(rect, popoverRect, align);
              } else if (placement === 'left') {
                top = nsPopover.positionY(rect, popoverRect, align);
                left = rect.left - popoverRect.width;
              }

              left = left < 0 ? 0 : left;
              popover.css({'top': top.toString() + 'px', 'left': left.toString() + 'px', 'visibility': 'visible'});

              if (triangle && triangle.length) {
                if (placement === 'top' || placement === 'bottom') {
                  left = rect.left + rect.width / 2 - left;
                  triangle.css('left', left.toString() + 'px');
                } else {
                  top = rect.top + rect.height / 2 - top;
                  triangle.css('top', top.toString()  + 'px');
                }
              }
            },0);
          }

          function getBoundingClientRect(elm) {
            var w = window;
            var doc = document.documentElement || document.body.parentNode || document.body;
            var x = (isDef(w.pageXOffset)) ? w.pageXOffset : doc.scrollLeft;
            var y = (isDef(w.pageYOffset)) ? w.pageYOffset : doc.scrollTop;
            var rect = elm.getBoundingClientRect();

            // ClientRect class is immutable, so we need to return a modified copy
            // of it when the window has been scrolled.
            if (x || y) {
              return {
                bottom:rect.bottom + y,
                left:rect.left + x,
                right:rect.right + x,
                top:rect.top + y,
                height:rect.height,
                width:rect.width
              };
            }

            doc = null;
            w = null;

            return rect;
          }

          //need to check this for id
          function outsideClickHandler(e) {
            if ($popover && e.target !== elm[0]) {
              if (!isInPopover(e.target, $popover[0].id)) {
                destroy();
              }
            }
          }

          function isInPopover(el, id) {
            if (el.id === id) {
              return true;
            }

            var parent = angular.element(el).parent()[0];

            if (!parent) {
              return false;
            } else if(parent.id === id){
              parent = null;
              return true;
            } else {
              return isInPopover(parent, id);
            }
          }

      }
    }
  ]);
})(window, window.angular);