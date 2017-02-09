$('.toc ul a[href^=#]').on('click', function(e){
	var href = $(this).attr('href');
	var dest = $(href).offset().top - $('div.vectorMenu#usermenu').height();
	window.history.pushState({}, '', $(this).prop('href'));
	$('html, body').scrollTop(dest);
	e.preventDefault();
});
