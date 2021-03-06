var https=false;
var ephemeral=true; //flag to turn ephemerality on and off for testing purposes
var player; //youtube player object 
var videoID; //youtube id for the youtube video
var mediaRecorder; //object that handles video recording
var finished=false; //flag that shows whether video is finished playing
var video_length=2000; //length that recording should be
var pause = video_length+1000; //pause length after recording starts till video should be savedc
var time=3; //time displayed on countdown on top of webcam 
var library ={}; //structure to store all of the reaction videos 
var username; //username of current viewer
var cur_video_blob; //most recently recorded blob 
var purpose_blob;
var fb_instance_mainVid; //fire base instance containing the main video 
var fb_instance_reactions; //firebase instance for the reaction videos 
//var sentTo=[]; //arry of people to send the video to (used by email feature)
var cameraOn = false; //keeps track of whether the user has enabled the webcam
var ownerName;
var reactionsCount = 0; //number of reaction videos displayed
var videoLengthLimit = 180; //in seconds
var current_user_is_owner = false; //flag that says whether the current user is the owner
var player_state="new";
var xmlhttp = new XMLHttpRequest();

  cur_video_blob = null;
  var fb_instance;
  purpose_blob = null;
    var user;


  $(document).ready(function(){
    if (navigator.userAgent.indexOf("Linux") > -1) {
      document.getElementById("arrow").src="images/arrow-mirror.png";
      document.getElementById("arrow").style.right="";
      document.getElementById("arrow").style.left="487px";
      document.getElementById("message").style.right="";
      document.getElementById("message").style.left="652px";
    } else if (navigator.userAgent.indexOf("Windows") > -1) {
      document.getElementById("arrow").src="images/arrow-mirror.png";
      document.getElementById("arrow").style.right="";
      document.getElementById("arrow").style.left="475px";
      document.getElementById("message").style.right="";
      document.getElementById("message").style.left="640px";
    }
    connect_to_chat_firebase();
  });

  function createCopyButton() {
    var client = new ZeroClipboard( document.getElementById("copy-button"), {} );

    client.on( "load", function(client) {
      // alert( "movie is loaded" );

      client.on( "complete", function(client, args) {
        // `this` is the element that was clicked
        // this.style.display = "none";
        this.innerHTML = "Copied!";
        // alert("Copied text to clipboard: " + args.text );
      } );
    } );
  }

  function connect_to_chat_firebase(){
    /* Include your Firebase link here!*/
    fb_instance = new Firebase("https://youtube-react.firebaseio.com");

    // generate new chatroom id or use existing id
    var url_segments = document.location.href.split("/#");
    if(url_segments[1]){
      fb_chat_room_id = url_segments[1];
    }else{
      fb_chat_room_id = Math.random().toString(36).substring(7);
    }
    //display_msg({m:"Share this url with your friend to join this chat: "+ document.location.origin+"/#"+fb_chat_room_id,c:"red"})

    // set up variables to access firebase data structure
    var fb_new_chat_room = fb_instance.child('chatrooms').child(fb_chat_room_id);
    var fb_instance_users = fb_new_chat_room.child('users');
    var fb_instance_stream = fb_new_chat_room.child('stream');
    var fb_owner = fb_new_chat_room.child('owner');
    fb_instance_mainVid = fb_new_chat_room.child('mainVid');
    fb_instance_reactions = fb_new_chat_room.child('reactions');
    var my_color = "#"+((1<<24)*Math.random()|0).toString(16);

    // listen to events
    refreshPage();

     fb_instance_stream.on("child_added",function(snapshot){
      display_msg(snapshot.val());
    });

    var cookieVal ="; " + document.cookie
    var cookieParts = cookieVal.split("; "+ "username"+"=");
    if(cookieParts.length==2){
      username=cookieParts[1].split(";")[0];
      document.getElementById("welcome").innerHTML="Welcome, "+username+"";
    }
    else{
      updateName();
    }
    document.getElementById("change_name").style.display="block";


    //add user as owner if there is no owner
    fb_owner.once('value', function(snapshot) {
      if(snapshot.val() === null) {
        //There's no owner, so add one
        fb_owner.set({ name: username});
      }
    });

    // check if user was the one who created the room
    fb_owner.on('value', function(snapshot) {
      var owner_info = snapshot.val();
      ownerName = owner_info.name;
      if(ownerName == username) {
        //current user is the owner of the room, so set global variable
        current_user_is_owner = true; 
       // alert('User is the owner.');
       document.getElementById("reactions").style.display="block";
       document.getElementById("friend_guide").style.display="none";
       createCopyButton();
       ga("send", "event", "owner", "visit");
      } else {
        //alert('User is NOT the owner');
        //connect_webcam();
        ga("send", "event", "non-owner", "visit");
        document.getElementById("reactions").style.display="none";
        document.getElementById("owner_guide").style.display="none";
      }
    });

        //display reactions that have already been recorded if current user is owner
    fb_instance_reactions.on("child_added", function(snapshot){
       if(current_user_is_owner){
        document.getElementById("sendInvites").style.display="none";
        document.getElementById("sendMore").style.display="block";
        appendVideo(snapshot.val().name, snapshot.val().v);
      }
    });


        //display video if one is already associated with the room
    fb_instance_mainVid.on("child_added",function(snapshot){
      addVideo(snapshot.val().url);
      if(current_user_is_owner && reactionsCount==0){
        displayShareDiv();
      }
    });

    fb_instance_users.push({ name: username,c: my_color});
    $("#waiting").remove();


    // scroll to bottom in case there is already content
    //scroll_to_bottom(1300);
  }



  function scroll_to_bottom(wait_time){
    // scroll to bottom of div
    setTimeout(function(){
      $("html, body").animate({ scrollTop: $(document).height() }, 200);
    },wait_time);
  }

  function connect_webcam(){
    // we're only recording video, not audio
    var mediaConstraints = {
      video: true,
      audio: false
    };

    // callback for when we get video stream from user.
    var onMediaSuccess = function(stream) {
      media_stream = stream;
      player.playVideo();
      document.getElementById("camera_message").style.display="none";
      $("#blur").toggleClass("blurOn");
      cameraOn=true;

      // create video element, attach webcam stream to video element
      var video_width= 160;
      var video_height= 120;
      var webcam_stream = document.getElementById('webcam_stream');
      var video = document.createElement('video');
      webcam_stream.innerHTML = "";
      // adds these properties to the video
      video = mergeProps(video, {
          controls: false,
          width: video_width,
          height: video_height,
          src: URL.createObjectURL(stream)
      });
      video.play();
      webcam_stream.appendChild(video);

      // add recording message
      var rm_div = document.createElement('div');
      rm_div.setAttribute("id", "record_message");
      rm_div.appendChild(document.createTextNode("Recording..."));
      webcam_stream.appendChild(rm_div);

      // counter
      var time = 0;
      var second_counter = document.getElementById('second_counter');
      var second_counter_update = setInterval(function(){
        second_counter.innerHTML = time++;
      },1000);

      // now record stream in 5 seconds interval
      var video_container = document.getElementById('video_container');
      mediaRecorder = new MediaStreamRecorder(stream);
      var index = 1;

      mediaRecorder.mimeType = 'video/webm';
      // mediaRecorder.mimeType = 'image/gif';
      // make recorded media smaller to save some traffic (80 * 60 pixels, 3*24 frames)
      mediaRecorder.video_width = video_width/2;
      mediaRecorder.video_height = video_height/2;

      mediaRecorder.ondataavailable = function (blob) {
          video_container.innerHTML = "";
          console.log("data available");
          // convert data into base 64 blocks
          blob_to_base64(blob,function(b64_data){
            cur_video_blob = b64_data;
          });
      };
    }

    // callback if there is an error when we try and get the video stream
    var onMediaError = function(e) {
      console.error('media error', e);
    }

    // get video stream from user. see https://github.com/streamproc/MediaStreamRecorder
    navigator.getUserMedia(mediaConstraints, onMediaSuccess, onMediaError);
  }

  // some handy methods for converting blob to base 64 and vice versa
  // for performance bench mark, please refer to http://jsperf.com/blob-base64-conversion/5
  // note useing String.fromCharCode.apply can cause callstack error
  var blob_to_base64 = function(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      callback(base64);
    };
    reader.readAsDataURL(blob);
  };

  var base64_to_blob = function(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    var blob = new Blob([view]);
    return blob;
  };


/*
* Called when the user uploads a video url.
* Calls the proper functions to display the video and to display the sharing information
*/
function urlAdded(){
  vidUrl=document.getElementById("url").value;
  if(vidUrl.indexOf("youtube")!=-1 && vidUrl.indexOf("v="!=-1)){
     vidUrl=vidUrl.match("v=[^&]*");
     vidUrl=vidUrl[0].replace("v=", "");
     request=$.ajax({
      type:"GET",
      url:"http://gdata.youtube.com/feeds/api/videos/"+vidUrl,
      statusCode:{
        400:function(){     
          // alert(xhr.status); 
          document.getElementById("error").style.display="block";},
        200:function(data){
          if(($(data).find('duration').attr('seconds'))<=videoLengthLimit){
            addValidVideo();
          }else{
            document.getElementById("error").innerHTML="<img src='images/alert.png'> Video too long. Please upload a video shorter than 3 minutes";
            document.getElementById("error").style.display="block";
          } 
        }
      },
     });
   }else{
    document.getElementById("error").innerHTML="<img src='images/alert.png'> Please enter a valid youtube link";
    document.getElementById("error").style.display="block";
   }
}

function addValidVideo(){

    document.getElementById("error").style.display="none";
     addVideo(vidUrl);
     fb_instance_mainVid.push({ url: vidUrl});
     displayShareDiv();
}

/*
* Displays the div with information about how to share the video
* Called once a video is uploaded
*/
function displayShareDiv(){
   var link=document.location.origin+"/#"+fb_chat_room_id;
   document.getElementById("shareLink").value=link;
   document.getElementById("shareLink").readOnly=true;
   document.getElementById("sendInvites").style.display="block";
}

/*
* Hides the share div
*/
function closeShare(){
  document.getElementById("sendInvites").style.display="none";
  document.getElementById("sendMore").style.display="block";
}

/*
* Adds the youtube video selected by the user to the page
*/
  function addVideo(vidUrl){
    document.getElementById("shareDiv").style.display="none";
    tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    player;
    videoID=vidUrl;
    done = false;
  }

/*
* youtube api function called when the api frame is ready
*/
   function onYouTubeIframeAPIReady() {
        player = new YT.Player('playVideo', {
          videoId: videoID,
           playerVars: { 
              'rel': 0, 
          }, 
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
          }
        });
      }

/*
* Youtube api function called when the video is loaded
*/
  function onPlayerReady(event) {
        //event.target.playVideo();
      }

/*
* youtube api function called whenever the state of the player changes (eg play/pause)
* if the video starts playing this function causes the reaction videos to start playing if the user is the owner
* If the user is the owner it calls the function to begin recording
*/
  function onPlayerStateChange(event) {
    //if video starts playing
    console.log("event" + YT.PlayerState );
        if (event.data == YT.PlayerState.PLAYING) {
          player_state="playing";
          if(!cameraOn && !current_user_is_owner){
            player.stopVideo();
            player.seekTo(0, false);
            connect_webcam();
            document.getElementById("camera_message").style.display="block";
             $("#blur").toggleClass("blurOn");
            return;
          }
          video_length=player.getDuration()*1000;
          pause = video_length+1000;
          if(!current_user_is_owner){
            if(mediaRecorder.state=="paused" && !(window.mozInnerScreenX == null)){
              mediaRecorder.state=="recording";
              mediaRecorder.resume();
            }else{
              recordWatcher();
            }
          }
          if(current_user_is_owner){
            var vids= document.getElementsByClassName("reactionVid");
            var currentTime = player.getCurrentTime();
            for(var i=0; i<vids.length; i++){
               vids[i].currentTime=currentTime;
               vids[i].play();
               vids[i].parentNode.className=vids[i].parentNode.className+" viewed"
               reactionsCount--;
            }
          }
        }
        //if video finishes playing
        else if(event.data==0){
          player_state="ended";
          if(!current_user_is_owner){
            media_stream.stop(); //turns off camera
          }
        }
        if (event.data === 0 && ephemeral && current_user_is_owner) {
          console.log("end");
          var vidsViewed= document.getElementsByClassName("viewed");
           //for(var i=0; i<vidsViewed.length; i++){
              // vidsViewed[i].style.display="none";
            //}
             fb_instance_reactions.remove();
        }
        else if(event.data==YT.PlayerState.PAUSED){
          player_state="paused";
           if(current_user_is_owner){
              var vids= document.getElementsByClassName("reactionVid");
              for(var i=0; i<vids.length; i++){
                 vids[i].pause();
              }
          }else{
            mediaRecorder.stop();
            mediaRecorder.state="paused";
            console.log(mediaRecorder.state)            
          }
        }
        console.log(player_state);
      }


  function stopVideo() {
        player.stopVideo();
      }

  function playVideo() {
      player.playVideo();
  }

/*
* called once the viewer presses play on a video 
* calls the function that triggers the recording and saves the video after the 
* length of the video has passed
*/
  function recordWatcher(){
        record(mediaRecorder);
        setTimeout(function(){saveVideo(username)},pause);
      }

/*
* This function is called once a reaction video is finished recording
* It saves the video to firebase
*/
  function saveVideo(string){
      library[string]=cur_video_blob;
      var url = URL.createObjectURL(base64_to_blob(library[string]));
      fb_instance_reactions.push({name: username, v:cur_video_blob})
    }

/*
* This function adds a reaction video to the page
* It takes a url to a video and a username to display beneath the video
*/
    function appendVideo(name, url){

      var url = URL.createObjectURL(base64_to_blob(url));
      var video = document.createElement("video");
      video.className="reactionVid";
      var container = document.createElement("div");
      container.className="reactionDiv"
      video.autoplay = false;
      video.controls = false; // optional
      video.loop = false;
      video.width = 320;
      var source = document.createElement("source");
      source.src =  url;
      source.type =  "video/webm";
      video.title=name;
      video.appendChild(source);
      var title = document.createElement("h2");
      title.innerText=name;
      container.appendChild(title);

      //make clicking reaction video start youtube video
      video.onclick = function(){
        if(player_state=="paused"||player_state=="new"){
          console.log("clicked video");
          playVideo();
        }else if(player_state=="playing"){
          player.pauseVideo();
        }else if(player_state=="ended"){
           player.seekTo(0, false);
           playVideo();
        }
      };
      container.appendChild(video);

      document.getElementById("reactions").appendChild(container);
      $('#reactions').slickAdd(container);
      reactionsCount += 1;
      if(reactionsCount<=3){
        $('#reactions').slickSetOption("slidesToShow",reactionsCount,true)
      }
      document.getElementById("playVideo").style.height=50;
    }

/*
* This is the function that gets called when the viewer starts watching the video
* It starts a recording of the same length as the video and displays the web cam view
*/
  var record = function(mediaRecorder){
     time=3;
     document.getElementById("second_counter").style.display="block";
     document.getElementById("webcam_stream").style.display="block";
     mediaRecorder.start(video_length);
     setTimeout(function(){document.getElementById("webcam_stream").style.display="none"}, pause);
     setTimeout(function(){document.getElementById("second_counter").style.display="none"}, pause);  
  }


//displays popup to update username
  function updateName(){
    username = window.prompt("Welcome to Youtube React! Enter your real name to begin");
    if(!username){
      username = "anonymous"+Math.floor(Math.random()*1111);
    }
    //add username to cookie
    document.cookie="username="+username;
    document.getElementById("welcome").innerHTML="Welcome "+username+"!";
    return true;
  }

  function changeName(){
    var refresh=updateName();
    if(refresh)
      location.reload(true);
  }

  function refreshPage(){
    var location = document.location.origin;
    if(https){
      location = location.slice(0,4)+"s"+location.slice(4); //THIS LINE TURNS ON HTTPS. Doesn't work locally
    }
    window.location.href=location+"/#"+fb_chat_room_id;
  }

//This is the email feature from the previous version
  function sendEmail(){
     var link=document.location.origin+"/#"+fb_chat_room_id;
     document.location.href="mailto:?subject=&body=I want to share a video with you. Check it out at this link: "+link;
    //}
    document.getElementById("sendInvites").style.display="none";
    document.getElementById("sendMore").style.display="block";
  }

//links with facebook to send through message
  function sendFB(){
    var location = document.location.origin;
     FB.ui({
      method: 'send',
      link: location+"/#"+fb_chat_room_id,
    });
     document.getElementById("sendInvites").style.display="none";
    document.getElementById("sendMore").style.display="block";
  }

  window.onbeforeunload = function (e) {
    e.cancelBubble = true;
    e.stopPropagation();
    e.preventDefault();
    if(player_state=="playing" || player_state=="paused")
          setTimeout(function(){
            mediaRecorder.stop();
            setTimeout(function(){saveVideo(username)},100);
            media_stream.stop();
          },1);
      for(var i=1; i<2000;i++){
        console.log("");
      }
   }