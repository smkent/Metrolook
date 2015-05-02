/*!
 * Add search suggestions to the search form.
 */
( function ( mw, $ ) {
	$( function () {
		var api, map, resultRenderCache, searchboxesSelectors,
			// Region where the suggestions box will appear directly below
			// (using the same width). Can be a container element or the input
			// itself, depending on what suits best in the environment.
			// For Vector the suggestion box should align with the simpleSearch
			// container's borders, in other skins it should align with the input
			// element (not the search form, as that would leave the buttons
			// vertically between the input and the suggestions).
			$searchRegion = $( '#simpleSearch, #simpleSearchSearch, #searchInput' ).first(),
			$searchInput = $( '#searchInput' ),
			previousSearchText = $searchInput.val();

		// Compatibility map
		map = {
			// SimpleSearch is broken in Opera < 9.6
			opera: [['>=', 9.6]],
			// Older Konquerors are unable to position the suggestions correctly (bug 50805)
			konqueror: [['>=', '4.11']],
			docomo: false,
			blackberry: false,
			// Support for iOS 6 or higher. It has not been tested on iOS 5 or lower
			ipod: [['>=', 6]],
			iphone: [['>=', 6]]
		};

		if ( !$.client.test( map ) ) {
			return;
		}

		// Compute form data for search suggestions functionality.
		function computeResultRenderCache( context ) {
			var $form, baseHref, linkParams;

			// Compute common parameters for links' hrefs
			$form = context.config.$region.closest( 'form' );

			baseHref = $form.attr( 'action' );
			baseHref += baseHref.indexOf( '?' ) > -1 ? '&' : '?';

			linkParams = $form.serializeObject();

			return {
				textParam: context.data.$textbox.attr( 'name' ),
				linkParams: linkParams,
				baseHref: baseHref
			};
		}

		/**
		 * Callback that's run when the user changes the search input text
		 * 'this' is the search input box (jQuery object)
		 * @ignore
		 */
		function onBeforeUpdate() {
			var searchText = this.val();

			if ( searchText && searchText !== previousSearchText ) {
				mw.track( 'mediawiki.searchSuggest', 'mediawiki.searchSuggest.custom', 'skins.metrolook.js', {
					action: 'session-start'
				} );
			}
			previousSearchText = searchText;
		}

		/**
		 * Callback that's run when suggestions have been updated either from the cache or the API
		 * 'this' is the search input box (jQuery object)
		 * @ignore
		 */
		function onAfterUpdate() {
			var context = this.data( 'suggestionsContext' );

			mw.track( 'mediawiki.searchSuggest', 'mediawiki.searchSuggest.custom', 'skins.metrolook.js', {
				action: 'impression-results',
				numberOfResults: context.config.suggestions.length,
				// FIXME: when other types of search become available change this value accordingly
				// See the API call below (opensearch = prefix)
				resultSetType: 'prefix'
			} );
		}

		// The function used to render the suggestions.
		function renderFunction( text, context ) {
			if ( !resultRenderCache ) {
				resultRenderCache = computeResultRenderCache( context );
			}

			// linkParams object is modified and reused
			resultRenderCache.linkParams[ resultRenderCache.textParam ] = text;

			// this is the container <div>, jQueryfied
			this.text( text )
				.wrap(
					$( '<a>' )
						.attr( 'href', resultRenderCache.baseHref + $.param( resultRenderCache.linkParams ) )
						.attr( 'title', text )
						.addClass( 'mw-searchSuggest-link' )
				);
		}

		// The function used when the user makes a selection
		function selectFunction( $input ) {
			var context = $input.data( 'suggestionsContext' ),
				text = $input.val();

			mw.track( 'mediawiki.searchSuggest', 'mediawiki.searchSuggest.custom', 'skins.metrolook.js', {
				action: 'click-result',
				numberOfResults: context.config.suggestions.length,
				clickIndex: context.config.suggestions.indexOf( text ) + 1
			} );

			// allow the form to be submitted
			return true;
		}

		function specialRenderFunction( query, context ) {
			var $el = this;

			if ( !resultRenderCache ) {
				resultRenderCache = computeResultRenderCache( context );
			}

			// linkParams object is modified and reused
			resultRenderCache.linkParams[ resultRenderCache.textParam ] = query;

			if ( $el.children().length === 0 ) {
				$el
					.append(
						$( '<div>' )
							.addClass( 'special-label' )
							.text( mw.msg( 'searchsuggest-containing' ) ),
						$( '<div>' )
							.addClass( 'special-query' )
							.text( query )
					)
					.show();
			} else {
				$el.find( '.special-query' )
					.text( query );
			}

			if ( $el.parent().hasClass( 'mw-searchSuggest-link' ) ) {
				$el.parent().attr( 'href', resultRenderCache.baseHref + $.param( resultRenderCache.linkParams ) + '&fulltext=1' );
			} else {
				$el.wrap(
					$( '<a>' )
						.attr( 'href', resultRenderCache.baseHref + $.param( resultRenderCache.linkParams ) + '&fulltext=1' )
						.addClass( 'mw-searchSuggest-link' )
				);
			}
		}

		// Generic suggestions functionality for all search boxes
		searchboxesSelectors = [
			// Primary searchbox on every page in standard skins
			'#searchInput',
			// Special:Search
			'#powerSearchText',
			'#searchText',
			// Generic selector for skins with multiple searchboxes (used by CologneBlue)
			// and for MediaWiki itself (special pages with page title inputs)
			'.mw-searchInput'
		];
		$( searchboxesSelectors.join( ', ' ) )
			.suggestions( {
				fetch: function ( query, response, maxRows ) {
					var node = this[0];

					api = api || new mw.Api();

					$.data( node, 'request', api.get( {
						action: 'opensearch',
						search: query,
						namespace: 0,
						limit: maxRows,
						suggest: ''
					} ).done( function ( data ) {
						response( data[ 1 ] );
					} ) );
				},
				cancel: function () {
					var node = this[0],
						request = $.data( node, 'request' );

					if ( request ) {
						request.abort();
						$.removeData( node, 'request' );
					}
				},
				result: {
					render: renderFunction,
					select: function () {
						// allow the form to be submitted
						return true;
					}
				},
				cache: true,
				highlightInput: true
			} )
			.bind( 'paste cut drop', function () {
				// make sure paste and cut events from the mouse and drag&drop events
				// trigger the keypress handler and cause the suggestions to update
				$( this ).trigger( 'keypress' );
			} )
			// In most skins (at least Monobook and Vector), the font-size is messed up in <body>.
			// (they use 2 elements to get a sane font-height). So, instead of making exceptions for
			// each skin or adding more stylesheets, just copy it from the active element so auto-fit.
			.each( function () {
				var $this = $( this );
				$this
					.data( 'suggestions-context' )
					.data.$container
						.css( 'fontSize', $this.css( 'fontSize' ) );
			} );

		// Ensure that the thing is actually present!
		if ( $searchRegion.length === 0 ) {
			// Don't try to set anything up if simpleSearch is disabled sitewide.
			// The loader code loads us if the option is present, even if we're
			// not actually enabled (anymore).
			return;
		}

		// Special suggestions functionality and tracking for skin-provided search box
		$searchInput.suggestions( {
			update: {
				before: onBeforeUpdate,
				after: onAfterUpdate
			},
			result: {
				render: renderFunction,
				select: selectFunction
			},
			special: {
				render: specialRenderFunction,
				select: function ( $input ) {
					$input.closest( 'form' )
						.append( $( '<input type="hidden" name="fulltext" value="1"/>' ) );
					return true; // allow the form to be submitted
				}
			},
			$region: $searchRegion
		} );

		// If the form includes any fallback fulltext search buttons, remove them
		$searchInput.closest( 'form' ).find( '.mw-fallbackSearchButton' ).remove();
	} );

}( mediaWiki, jQuery ) );