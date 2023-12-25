function init() {
    /** Define button behavior. */
    document.querySelector('.finished.getimg.button').addEventListener('click', generateImage);
    document.querySelector('.finished.list.button').addEventListener('click', generateTextList);
}

function initList(){
    var n = 0;
    var mid;
    var i;

    lstMember[n] = new Array();
    for (i=0; i<namMember.length; i++) {
        lstMember[n][i] = i;
    }
    parent[n] = -1;
    totalSize = 0;
    n++;

    for (i=0; i<lstMember.length; i++) {
        if(lstMember[i].length>=2) {
            mid = Math.ceil(lstMember[i].length/2);
            lstMember[n] = new Array();
            lstMember[n] = lstMember[i].slice(0,mid);
            totalSize += lstMember[n].length;
            parent[n] = i;
            n++;
            lstMember[n] = new Array();
            lstMember[n] = lstMember[i].slice(mid,lstMember[i].length);
            totalSize += lstMember[n].length;
            parent[n] = i;
            n++;
        }
    }

    for (i=0; i<namMember.length; i++) {
        rec[i] = 0;
    }
    nrec = 0;

    for (i=0; i<=namMember.length; i++) {
        equal[i] = -1;
    }

    cmp1 = lstMember.length-2;
    cmp2 = lstMember.length-1;
    head1 = 0;
    head2 = 0;
    numQuestion = 1;
    finishSize = 0;
    finishFlag = 0;
}

function sortList(flag){
    var i;
    var str;

    if (flag<0) {
        rec[nrec] = lstMember[cmp1][head1];
        head1++;
        nrec++;
        finishSize++;
        while (equal[rec[nrec-1]]!=-1) {
            rec[nrec] = lstMember[cmp1][head1];
            head1++;
            nrec++;
            finishSize++;
        }
    }
    else if (flag>0) {
        rec[nrec] = lstMember[cmp2][head2];
        head2++;
        nrec++;
        finishSize++;
        while (equal[rec[nrec-1]]!=-1) {
            rec[nrec] = lstMember[cmp2][head2];
            head2++;
            nrec++;
            finishSize++;
        }
    }
    else {
        rec[nrec] = lstMember[cmp1][head1];
        head1++;
        nrec++;
        finishSize++;
        while (equal[rec[nrec-1]]!=-1) {
            rec[nrec] = lstMember[cmp1][head1];
            head1++;
            nrec++;
            finishSize++;
        }
        equal[rec[nrec-1]] = lstMember[cmp2][head2];
        rec[nrec] = lstMember[cmp2][head2];
        head2++;
        nrec++;
        finishSize++;
        while (equal[rec[nrec-1]]!=-1) {
            rec[nrec] = lstMember[cmp2][head2];
            head2++;
            nrec++;
            finishSize++;
        }
    }

    if (head1<lstMember[cmp1].length && head2==lstMember[cmp2].length) {
        while (head1<lstMember[cmp1].length){
            rec[nrec] = lstMember[cmp1][head1];
            head1++;
            nrec++;
            finishSize++;
        }
    }
    else if (head1==lstMember[cmp1].length && head2<lstMember[cmp2].length) {
        while (head2<lstMember[cmp2].length){
            rec[nrec] = lstMember[cmp2][head2];
            head2++;
            nrec++;
            finishSize++;
        }
    }

    if (head1==lstMember[cmp1].length && head2==lstMember[cmp2].length) {
        for (i=0; i<lstMember[cmp1].length+lstMember[cmp2].length; i++) {
            lstMember[parent[cmp1]][i] = rec[i];
        }
        lstMember.pop();
        lstMember.pop();
        cmp1 = cmp1-2;
        cmp2 = cmp2-2;
        head1 = 0;
        head2 = 0;

        //Initialize the rec before performing the new comparison
        if (head1==0 && head2==0) {
            for (i=0; i<namMember.length; i++) {
                rec[i] = 0;
            }
            nrec = 0;
        }
    }

    if (cmp1<0) {
        str = "Choice "+(numQuestion-1)+"<br>"+Math.floor(finishSize*100/totalSize)+"% done.";
        document.getElementById("battleNumber").innerHTML = str;

        showResult();
        finishFlag = 1;
    }
    else {
        showImage();
    }
}

function showResult() {
    var ranking = 1;
    var sameRank = 1;
    /*var str = "";*/
    var str = "<div class=\"rank-grid\">";
    var i;

    /*str += "<table style=\"width:320px; font-size:15px; line-height:120%; margin-left:auto; margin-right:auto; border:1px solid #888888; border-collapse:collapse; font-family:'Nunito',sans-serif;\" align=\"center\">";
    str += "<tr><td style=\"color:#ffffff; background-color:#888888; text-align:center;\">Rank<\/td><td style=\"color:#ffffff; background-color:#888888; text-align:center; font-family:'Nunito',sans-serif;\">Name<\/td><\/tr>";*/

    for (i=0; i<namMember.length; i++) {
        /*str += "<tr><td style=\"border:1px solid #888888; width:25px; text-align:center; padding-right:5px; font-family:'Nunito',sans-serif;\">"+ranking+"<\/td><td style=\"border:1px solid #888888; width:175px; text-align:center; padding-left:5px; font-family:'Nunito',sans-serif;\">"+namMember[lstMember[0][i]]+"<\/td><\/tr>";*/
        str += "<li style=\"list-style-type: none; padding: 5px; font-size: 15px; line-height: 120%; font-family: 'Nunito', sans-serif; font-weight: bold;\">" + ranking + "<br>" + namMember[lstMember[0][i]] + "</li>";
        
        if (i<namMember.length-1) {
            if (equal[lstMember[0][i]]==lstMember[0][i+1]) {
                sameRank++;
            } else {
                ranking += sameRank;
                sameRank = 1;
            }
        }
    }
    /*str += "<\/table>";*/
    str += "</div>";

    document.getElementById("resultField").innerHTML = str;
}

function showImage() {
    var str0 = "Choice "+numQuestion+"<br>"+Math.floor(finishSize*100/totalSize)+"%<br>";
    var str1 = ""+toNameFace(lstMember[cmp1][head1]);
    var str2 = ""+toNameFace(lstMember[cmp2][head2]);

    document.getElementById("battleNumber").innerHTML = str0;
    document.getElementById("leftField").innerHTML = str1;
    document.getElementById("rightField").innerHTML = str2;

    numQuestion++;
}

function toNameFace(n){
    var str = namMember[n];
    return str;
}

function generateImage() {
    const timeFinished = timestamp + timeTaken;
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const filename = 'sort-' + (new Date(timeFinished - tzoffset)).toISOString().slice(0, -5).replace('T', '(') + ').png';

    html2canvas(document.querySelector('.resultField')).then(canvas => {
        const dataURL = canvas.toDataURL();
        const imgButton = document.querySelector('.finished.getimg.button');
        const resetButton = document.createElement('a');

        imgButton.removeEventListener('click', generateImage);
        imgButton.innerHTML = '';
        imgButton.insertAdjacentHTML('beforeend', `<a href="${dataURL}" download="${filename}">Download Image</a><br><br>`);

        resetButton.insertAdjacentText('beforeend', 'Reset');
        resetButton.addEventListener('click', (event) => {
        imgButton.addEventListener('click', generateImage);
        imgButton.innerHTML = 'Generate Image';
        event.stopPropagation();
        });
        imgButton.insertAdjacentElement('beforeend', resetButton);
    });
}

function generateTextList() {
    const data = namMember.reduce((str) => {
        str += `${ranking}. ${namMember[lstMember[0][i]]}<br>`;
        return str;
    }, '');
    const oWindow = window.open("", "", "height=640,width=480");
    oWindow.document.write(data);
}